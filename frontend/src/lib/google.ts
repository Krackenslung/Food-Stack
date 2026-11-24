/** Google Identity Services (GIS): loaded lazily, only when a sign-in screen needs it. */

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string }) => void
  }) => void
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let loading: Promise<GoogleId> | null = null

export function googleClientId(): string {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

export function loadGoogle(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)

  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google Identity Services did not initialize.'))
    }
    script.onerror = () => {
      loading = null // allow a retry on the next mount
      reject(new Error('Could not load Google Identity Services.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Initialize GIS and draw the official button into ``element``. */
export async function renderGoogleButton(
  element: HTMLElement,
  options: {
    clientId: string
    onCredential: (idToken: string) => void
    text: 'signin_with' | 'signup_with' | 'continue_with'
    locale: string
    dark: boolean
    width: number
  },
): Promise<void> {
  const google = await loadGoogle()
  google.initialize({
    client_id: options.clientId,
    callback: ({ credential }) => options.onCredential(credential),
  })
  google.renderButton(element, {
    type: 'standard',
    theme: options.dark ? 'filled_black' : 'outline',
    size: 'large',
    text: options.text,
    shape: 'rectangular',
    logo_alignment: 'center',
    locale: options.locale,
    width: options.width,
  })
}
