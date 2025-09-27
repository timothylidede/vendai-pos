import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

export const ORG_SETTINGS_COL = 'org_settings'

export type OrgSettings = {
  inventory_status?: 'not-started' | 'in-progress' | 'ready'
  allow_sandbox?: boolean
  theme_bg_hex?: string
  api_key?: string
  createdAt?: any
  createdBy?: string
  createdByEmail?: string | null
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings | null> {
  try {
    // Skip database operations during build
    if (!db) {
      console.warn('Firebase not initialized, returning default org settings')
      return {
        inventory_status: 'ready',
        allow_sandbox: true,
        theme_bg_hex: '#F6F4F2',
        api_key: 'dummy-key'
      }
    }
    
    const ref = doc(db, ORG_SETTINGS_COL, orgId)
    const snap = await getDoc(ref)
    return snap.exists() ? (snap.data() as OrgSettings) : null
  } catch (error) {
    console.warn('Firebase operation failed, returning default settings:', error)
    return {
      inventory_status: 'ready', 
      allow_sandbox: true,
      theme_bg_hex: '#F6F4F2',
      api_key: 'dummy-key'
    }
  }
}

export async function assertInventoryReady(orgId: string): Promise<{ ok: boolean; reason?: string; settings?: OrgSettings }> {
  const s = await getOrgSettings(orgId)
  if (!s) return { ok: false, reason: 'org_settings_missing' }
  if (s.inventory_status === 'ready') return { ok: true, settings: s }
  if (s.allow_sandbox) return { ok: true, reason: 'sandbox_allowed', settings: s }
  return { ok: false, reason: 'inventory_not_ready', settings: s }
}

export async function verifyApiKey(orgId: string, key?: string | null): Promise<boolean> {
  if (!key) return false
  const s = await getOrgSettings(orgId)
  return !!(s?.api_key && s.api_key === key)
}

/**
 * Create a URL-safe slug from an organization name.
 */
export function slugifyOrgId(name: string): string {
  const base = (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return base || 'org'
}

/**
 * Ensure the generated orgId is unique by checking the organizations/{id} doc.
 * Appends -2, -3, ... if needed.
 */
export async function ensureUniqueOrgId(name: string): Promise<{ orgId: string; displayName: string }>{
  const displayName = name.trim()
  let slug = slugifyOrgId(displayName)
  let attempt = 1
  while (true) {
    const candidate = attempt === 1 ? slug : `${slug}-${attempt}`
    try {
      const orgMetaRef = doc(db, 'organizations', candidate)
      const snap = await getDoc(orgMetaRef)
      if (!snap.exists()) {
        return { orgId: candidate, displayName }
      }
      attempt += 1
    } catch (e) {
      // On read failure, fallback to current candidate to avoid blocking onboarding
      console.warn('ensureUniqueOrgId check failed, proceeding with candidate:', e)
      return { orgId: attempt === 1 ? slug : `${slug}-${attempt}`, displayName }
    }
  }
}

/**
 * Create baseline documents for a new organization. Keeps all business data empty
 * so modules are gated until inventory is added.
 */
export async function createOrgScaffold(orgId: string, opts?: { creatorUid?: string; creatorEmail?: string | null; theme?: string; displayName?: string }) {
  if (!orgId) return
  try {
    const ref = doc(db, ORG_SETTINGS_COL, orgId)
    const existing = await getDoc(ref)
    // Create organizations metadata doc regardless (idempotent set)
    const orgMetaRef = doc(db, 'organizations', orgId)
    await setDoc(orgMetaRef, {
      id: orgId,
      name: orgId,
      displayName: opts?.displayName || orgId,
      createdAt: serverTimestamp(),
      createdBy: opts?.creatorUid || '',
      createdByEmail: opts?.creatorEmail ?? null,
    }, { merge: true })
    if (existing.exists()) return // already provisioned

    const payload: OrgSettings = {
      inventory_status: 'not-started',
      allow_sandbox: false, // enforce gating until inventory exists
      theme_bg_hex: opts?.theme || '#0B1220',
      api_key: '',
      createdAt: serverTimestamp(),
      createdBy: opts?.creatorUid || '',
      createdByEmail: opts?.creatorEmail ?? null,
    }
    await setDoc(ref, payload)
  } catch (e) {
    console.error('Failed to create org scaffold for', orgId, e)
  }
}
