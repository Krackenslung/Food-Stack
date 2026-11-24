/**
 * Demo-mode stand-in for a Google ID token: "mock-google:" + base64(JSON claims). The mock API
 * "verifies" it the way the real backend verifies a real token, so the same rules are exercised.
 */
export type MockGoogleClaims = {
  sub: string
  email: string
  email_verified: boolean
  given_name?: string
  family_name?: string
  [extra: string]: unknown
}

const PREFIX = 'mock-google:'

export const DEMO_GOOGLE_ACCOUNT: MockGoogleClaims = {
  sub: 'demo-google-sub-1',
  email: 'google.demo@example.com',
  email_verified: true,
  given_name: 'Google',
  family_name: 'Demo',
}

export function mockCredential(claims: MockGoogleClaims): string {
  return PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(claims))))
}

export function parseMockCredential(token: string): MockGoogleClaims | null {
  if (!token.startsWith(PREFIX)) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(token.slice(PREFIX.length)))))
  } catch {
    return null
  }
}
