'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listarGruposConIntegrantes, type GrupoParaSheet } from '@/lib/grupo'
import { ChipGrupo } from '@/components/app/ChipGrupo'
import { SelectorGrupoSheet } from '@/components/app/SelectorGrupoSheet'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'

interface HeaderGrupoInternoProps {
  grupoId: string
  grupoNombre: string
  // ruta de esta misma pantalla (p.ej. '/cuentas', '/cierre', '/grupo') —
  // elegir otro grupo en el sheet navega acá de nuevo con el nuevo ?grupo=
  rutaBase: string
}

/**
 * Header compartido por las pantallas que SIEMPRE requieren un grupo
 * puntual (Cuentas, Cierre, Grupo): volver a Inicio con ese grupo + chip
 * que abre el selector (sin "Todos los grupos", permitirTodos=false).
 */
export function HeaderGrupoInterno({ grupoId, grupoNombre, rutaBase }: HeaderGrupoInternoProps) {
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
    router.push(`${rutaBase}?grupo=${id}`)
  }

  function alTerminarFlujo(grupo: { id: string; nombre: string }) {
    setFlujoAbierto(null)
    router.push(`/?grupo=${grupo.id}`)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => router.push(`/?grupo=${grupoId}`)}
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
