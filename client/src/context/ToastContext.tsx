import { createContext, useCallback, useContext, useState } from 'react'

interface ToastItem {
  id: string
  message: string
  variant: 'success' | 'error'
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (message: string, variant?: 'success' | 'error') => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismiss: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
