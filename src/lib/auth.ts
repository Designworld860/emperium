// Simple JWT-like auth using Web Crypto API (Cloudflare Workers compatible)
const JWT_SECRET = 'emperium-city-grs-secret-2026'

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + JWT_SECRET)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return computed === hash
}

export function createToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 }))
  const sig = btoa(`${header}.${body}.${JWT_SECRET}`)
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp < Date.now()) return null
    const expectedSig = btoa(`${parts[0]}.${parts[1]}.${JWT_SECRET}`)
    if (parts[2] !== expectedSig) return null
    return payload
  } catch {
    return null
  }
}

export function getAuthUser(authHeader: string | null): Record<string, unknown> | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return verifyToken(authHeader.substring(7))
}
