'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarGruposConIntegrantes, hrefHomeGrupo, type GrupoParaSheet } from '@/lib/grupo'
import { ChipGrupo } from '@/components/app/ChipGrupo'
import { SelectorGrupoSheet } from '@/components/app/SelectorGrupoSheet'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'

interface HeaderGrupoInternoProps {
  grupoId: string
  grupoNombre: string
  // ruta de esta misma pantalla (p.ej. '/cuentas', '/cierre', '/grupo') —
  // por default, elegir otro grupo en el sheet navega acá de nuevo con el
  // nuevo ?grupo=. La home del grupo pasa su propio onElegirGrupo porque
  // no usa ese patrón de query param.
  rutaBase: string
  // a dónde vuelve el botón de volver — cada pantalla decide la suya
  // (las internas, a la home del grupo; la home misma, a /mis-grupos).
  volverHref: string
  // true solo en la home del grupo: engranaje a la derecha, abre /grupo.
  engranaje?: boolean
  onElegirGrupo?: (id: string) => void
}

/**
 * Header compartido por las pantallas que SIEMPRE requieren un grupo
 * puntual (Cuentas, Cierre, Grupo, la home del grupo): volver + chip que
 * abre el selector (sin "Todos los grupos", permitirTodos=false).
 */
export function HeaderGrupoInterno({ grupoId, grupoNombre, rutaBase, volverHref, engranaje, onElegirGrupo }: HeaderGrupoInternoProps) {
  const router = useRouter()
  const [grupos, setGrupos] = useState<GrupoParaSheet[]>([])
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [flujoAbierto, setFlujoAbierto] = useState<'crear' | 'unirse' | null>(null)

  useEffect(() => {
    let activo = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !activo) return
      listarGruposConIntegrantes(user.id).then(g => { if (activo) setGrupos(g) })
    })
    return () => { activo = false }
  }, [])

  function elegirGrupo(id: string) {
    setSheetAbierto(false)
    if (onElegirGrupo) { onElegirGrupo(id); return }
    router.push(`${rutaBase}?grupo=${id}`)
  }

  function alTerminarFlujo(grupo: { id: string; nombre: string }) {
    setFlujoAbierto(null)
    router.push(hrefHomeGrupo(grupo.id))
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => router.push(volverHref)}
          aria-label="Volver"
          style={{
            width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
            border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ChipGrupo grupo={{ id: grupoId, nombre: grupoNombre }} onClick={() => setSheetAbierto(true)} />
        {engranaje && (
          <Link
            href={`/grupo?grupo=${grupoId}`}
            aria-label="Ajustes del grupo"
            style={{
              width: 42, height: 42, borderRadius: '50%', background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 'auto',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
      </div>

      <SelectorGrupoSheet
        abierto={sheetAbierto}
        onCerrar={() => setSheetAbierto(false)}
        grupos={grupos}
        seleccionActual={grupoId}
        permitirTodos={false}
        onElegir={elegirGrupo}
        onCrearGrupo={() => { setSheetAbierto(false); setFlujoAbierto('crear') }}
        onUnirseConCodigo={() => { setSheetAbierto(false); setFlujoAbierto('unirse') }}
      />

      {flujoAbierto && (
        <FlujoCrearUnirseGrupo pasoInicial={flujoAbierto} onCerrar={() => setFlujoAbierto(null)} onListo={alTerminarFlujo} />
      )}
    </>
  )
}
