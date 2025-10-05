import type { NextRequest } from "next/server"

const sanitizePart = (value: string | number): string =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")

export const getRateLimitKey = (request: Request | NextRequest, ...parts: Array<string | number | undefined>): string => {
  const headers = request.headers
  const forwarded = headers.get("x-forwarded-for")
  const ipCandidate = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip")
  const requestWithIp = request as Partial<NextRequest> & { ip?: string | null }
  const ip = ipCandidate || requestWithIp.ip || "unknown"

  const userAgent = headers.get("user-agent") ?? "unknown"
  const uaFingerprint = userAgent
    .split(/\s+/)
    .slice(0, 3)
    .join("-") || "ua"

  const keyParts = [ip.toLowerCase(), uaFingerprint.toLowerCase()]

  parts
    .filter((part): part is string | number => part !== undefined && part !== null)
    .forEach((part) => keyParts.push(sanitizePart(part)))

  return keyParts.join(":")
}

export const getAuthScopedRateLimitKey = (
  request: Request | NextRequest,
  authIdentifier?: string | null,
  ...rest: Array<string | number | undefined>
): string => {
  const authPart = authIdentifier ? sanitizePart(authIdentifier) : undefined
  return getRateLimitKey(request, authPart, ...rest)
}
