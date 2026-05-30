'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  leerSesionLocal,
  cerrarSesion as cerrarSesionAuth,
  type SesionData,
} from '@/lib/auth'

// ============================================================
// Contexto
// ============================================================

interface SessionContextValue {
  sesion: SesionData | null
  loading: boolean
  setSesion: (s: SesionData | null) => void
  cerrarSesion: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

// ============================================================
// Provider
// ============================================================

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesionState] = useState<SesionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Leer sesión del localStorage al montar (solo client-side)
    const local = leerSesionLocal()
    setSesionState(local)
    setLoading(false)
  }, [])

  const setSesion = useCallback((s: SesionData | null) => {
    setSesionState(s)
  }, [])

  const cerrarSesion = useCallback(() => {
    cerrarSesionAuth()
    setSesionState(null)
  }, [])

  return (
    <SessionContext.Provider value={{ sesion, loading, setSesion, cerrarSesion }}>
      {children}
    </SessionContext.Provider>
  )
}

// ============================================================
// Hook
// ============================================================

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>')
  return ctx
}
