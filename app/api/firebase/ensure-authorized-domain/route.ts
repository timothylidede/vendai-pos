import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

type EnsureDomainResponse = {
  added: string[]
  existing: string[]
}

const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'

const sanitizeDomain = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
  const host = withoutProtocol.split('/')[0]
  if (!host) return null
  const [domain] = host.split(':')
  return domain || null
}

const isDevDomain = (domain: string): boolean => {
  return domain === 'localhost' || domain === '127.0.0.1'
}

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) return null

  const normalized = raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw
  try {
    const parsed = JSON.parse(normalized)
    if (parsed.private_key && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    }
    return parsed
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Domain management is only available in development.' }, { status: 403 })
  }

  const serviceAccount = getServiceAccount()
  const projectId = serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!serviceAccount || !projectId) {
    return NextResponse.json({ error: 'Firebase service account is not configured.' }, { status: 500 })
  }

  let domains: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body?.domains)) {
      domains = body.domains
    } else if (body?.domain) {
      domains = [body.domain]
    }
  } catch (error) {
    console.warn('Failed to parse request body for ensure-authorized-domain', error)
  }

  const sanitized = Array.from(new Set(domains.map((domain) => sanitizeDomain(domain)).filter(Boolean))) as string[]

  if (sanitized.length === 0) {
    return NextResponse.json({ error: 'No domains provided.' }, { status: 400 })
  }

  const devOnlyDomains = sanitized.filter(isDevDomain)
  if (devOnlyDomains.length === 0) {
    return NextResponse.json({ error: 'Only localhost or 127.0.0.1 domains can be authorized via this endpoint.' }, { status: 400 })
  }

  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      projectId,
      scopes: [REQUIRED_SCOPE],
    })

    const client = await auth.getClient()
    const baseUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`

    const existingResponse = await client.request<{ authorizedDomains?: string[] }>({
      url: baseUrl,
      method: 'GET',
    })

    const existingDomains = new Set(existingResponse.data.authorizedDomains ?? [])
    const addedDomains: string[] = []

    for (const domain of devOnlyDomains) {
      if (!existingDomains.has(domain)) {
        existingDomains.add(domain)
        addedDomains.push(domain)
      }
    }

    if (addedDomains.length > 0) {
      await client.request({
        url: `${baseUrl}?updateMask=authorizedDomains`,
        method: 'PATCH',
        data: {
          authorizedDomains: Array.from(existingDomains),
        },
      })
    }

    const payload: EnsureDomainResponse = {
      added: addedDomains,
      existing: Array.from(existingDomains),
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('Failed to ensure Firebase authorized domains', error)
    return NextResponse.json({ error: 'Failed to update Firebase authorized domains.' }, { status: 500 })
  }
}