import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export const ORG_SETTINGS_COL = 'org_settings'

export type OrgSettings = {
  inventory_status?: 'not-started' | 'in-progress' | 'ready'
  allow_sandbox?: boolean
  theme_bg_hex?: string
  api_key?: string
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings | null> {
  try {
    const ref = doc(db, ORG_SETTINGS_COL, orgId)
    const snap = await getDoc(ref)
    return snap.exists() ? (snap.data() as OrgSettings) : null
  } catch {
    return null
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
