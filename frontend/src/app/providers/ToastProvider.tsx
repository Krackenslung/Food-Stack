import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './ToastProvider.css'

type ToastContextValue = { show: (message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

/** Minimal live-region toast ("added to cart" confirmations). One message at a time. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((next: string) => {
    setMessage(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2400)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fs-toast-region" role="status" aria-live="polite">
        {message && (
          <div key={message} className="fs-toast">
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
