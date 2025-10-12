import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/firebase', () => ({
  db: {},
}))

const runTransactionMock = vi.fn()
const addDocMock = vi.fn()
const collectionMock = vi.fn()
const docMock = vi.fn()
const getDocMock = vi.fn()
const getDocsMock = vi.fn()
const updateDocMock = vi.fn()
const getCountFromServerMock = vi.fn()
const orderByMock = vi.fn()
const whereMock = vi.fn()
const limitMock = vi.fn()
const serverTimestampMock = vi.fn(() => new Date().toISOString())
const timestampMock = {
  fromDate: (date: Date) => date,
}
const writeBatchMock = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(),
}))

interface InventorySnapshot {
  qtyBase: number
  qtyLoose: number
  unitsPerBase: number
  version: number
  updatedAt?: string
  updatedBy?: string
}

const inventoryStore = new Map<string, InventorySnapshot>()

const createTransaction = () => {
  const readVersions = new Map<string, number>()
  const pendingWrites = new Map<string, Partial<InventorySnapshot>>()

  return {
    get: vi.fn(async (ref: any) => {
      const key = ref._key ?? ref.id
      const snapshot = inventoryStore.get(key)
      if (!snapshot) {
        return {
          exists: () => false,
        }
      }
      readVersions.set(key, snapshot.version ?? 0)
      const cloned = { ...snapshot }
      return {
        exists: () => true,
        data: () => cloned,
      }
    }),
    update: vi.fn(async (ref: any, updates: Partial<InventorySnapshot>) => {
      const key = ref._key ?? ref.id
      const existing = pendingWrites.get(key) ?? {}
      pendingWrites.set(key, { ...existing, ...updates })
    }),
    set: vi.fn(async () => {}),
    commit: () => {
      for (const [key, updates] of pendingWrites.entries()) {
        const current = inventoryStore.get(key)
        if (!current) {
          throw new Error(`Inventory ${key} missing during update`)
        }
        const currentVersion = current.version ?? 0
        const expectedVersion = readVersions.get(key) ?? currentVersion
        if (currentVersion !== expectedVersion) {
          const error: Error & { code?: string } = new Error('Transaction contention detected')
          error.code = 'aborted'
          throw error
        }
        inventoryStore.set(key, {
          ...current,
          ...updates,
          version: currentVersion + 1,
        })
      }
    },
  }
}

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => {
    collectionMock(...args)
    const [, collectionName] = args
    return { __collection: collectionName }
  },
  doc: (...args: any[]) => {
    if (args.length === 1 && args[0]?.__collection) {
      const generatedId = `order-${docMock.mock.calls.length + 1}`
      const ref = { id: generatedId, _key: generatedId, collection: args[0].__collection }
      docMock(args, ref)
      return ref
    }
    if (args.length >= 3) {
      const docId = args[args.length - 1]
      const ref = { id: docId, _key: docId, path: args.slice(1).join('/') }
      docMock(args, ref)
      return ref
    }
    throw new Error('Unsupported doc invocation')
  },
  addDoc: (...args: any[]) => {
    const id = `order-created-${addDocMock.mock.calls.length + 1}`
    addDocMock(...args)
    return Promise.resolve({ id })
  },
  runTransaction: (...args: any[]) => runTransactionMock(...args),
  getDoc: (...args: any[]) => {
    getDocMock(...args)
    return Promise.resolve({ exists: () => false })
  },
  getDocs: (...args: any[]) => {
    getDocsMock(...args)
    return Promise.resolve({ empty: true, docs: [] })
  },
  updateDoc: (...args: any[]) => {
    updateDocMock(...args)
    return Promise.resolve()
  },
  getCountFromServer: (...args: any[]) => {
    getCountFromServerMock(...args)
    return Promise.resolve({ data: () => ({ count: 0 }) })
  },
  orderBy: (...args: any[]) => {
    orderByMock(...args)
    return { __orderBy: args }
  },
  where: (...args: any[]) => {
    whereMock(...args)
    return { __where: args }
  },
  limit: (...args: any[]) => {
    limitMock(...args)
    return { __limit: args }
  },
  serverTimestamp: serverTimestampMock,
  Timestamp: timestampMock,
  writeBatch: writeBatchMock,
}))

const runTransactionWithRetries = async (
  updater: (tx: ReturnType<typeof createTransaction>) => Promise<string>,
) => {
  const MAX_ATTEMPTS = 5
  let attempt = 0
  for (;;) {
    attempt += 1
    const tx = createTransaction()
    try {
      const result = await updater(tx)
      tx.commit?.()
      return result
    } catch (error: any) {
      if (error?.code === 'aborted' || /contention/i.test(String(error?.message ?? ''))) {
        if (attempt >= MAX_ATTEMPTS) {
          throw error
        }
        continue
      }
      throw error
    }
  }
}

const { addPosOrder } = await import('@/lib/pos-operations')

describe('addPosOrder concurrency safeguards', () => {
  beforeEach(() => {
    inventoryStore.clear()
    inventoryStore.set('org-1_prod-1', {
      qtyBase: 10,
      qtyLoose: 0,
      unitsPerBase: 12,
      version: 0,
    })
    runTransactionMock.mockReset()
    runTransactionMock.mockImplementation(async (_db: unknown, updater: (tx: ReturnType<typeof createTransaction>) => Promise<string>) => runTransactionWithRetries(updater))
    addDocMock.mockReset()
    docMock.mockReset()
  })

  it('retries when Firestore reports contention', async () => {
    const concurrencyError = new Error('Transaction was aborted due to concurrency')

    runTransactionMock
      .mockImplementationOnce(async () => {
        throw concurrencyError
      })

    const orderId = await addPosOrder(
      'org-1',
      'cashier-7',
      [
        {
          productId: 'prod-1',
          name: 'Sample Product',
          quantityPieces: 6,
          unitPrice: 100,
          lineTotal: 600,
        },
      ],
    )

    expect(orderId).toMatch(/^order-created-/)
    expect(runTransactionMock).toHaveBeenCalledTimes(2)
  })

  it('handles concurrent cashiers without corrupting inventory', async () => {
    const payload = {
      org: 'org-1',
      userA: 'cashier-a',
      userB: 'cashier-b',
    }

    const lines = [
      {
        productId: 'prod-1',
        name: 'Sample Product',
        quantityPieces: 12,
        unitPrice: 120,
        lineTotal: 1440,
      },
    ]

    const [orderOne, orderTwo] = await Promise.all([
      addPosOrder(payload.org, payload.userA, lines),
      addPosOrder(payload.org, payload.userB, lines),
    ])

    expect(orderOne).not.toEqual(orderTwo)
    expect(runTransactionMock).toHaveBeenCalledTimes(2)

    const inventory = inventoryStore.get('org-1_prod-1')
    expect(inventory).toBeDefined()
    expect(inventory?.qtyBase).toBe(8)
    expect(inventory?.qtyLoose).toBe(0)
  })
})
