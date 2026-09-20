'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { verificarAccesoCuenta, type AccesoCuenta } from '@/lib/cuentas'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

type Estado = 'cargando' | 'sin-sesion' | 'invalido' | 'sin-acceso'

function IconoCirculo({ children, negativo }: { children: React.ReactNode; negativo?: boolean }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: negativo ? 'var(--color-negative-tint)' : 'var(--color-surface-white)',
      border: negativo ? 'none' : '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
    }}>
      {children}
    </div>
  )
}

function BotonPrimarioLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        height: 54, borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, color: '#fff', textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

function BotonSecundarioLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        height: 54, borderRadius: 15,
        background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

export default function AccesoCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [estado, setEstado] = useState<Estado>('cargando')
  const [acceso, setAcceso] = useState<AccesoCuenta | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!activo) return

      if (!user) { setEstado('sin-sesion'); return }

      const resultado = await verificarAccesoCuenta(id)
      if (!activo) return

      if (!resultado || !resultado.existe) { setEstado('invalido'); return }
      if (resultado.tiene_acceso) { router.replace(`/cuentas/${id}`); return }

      setAcceso(resultado)
      setEstado('sin-acceso')
    }

    cargar()
    return () => { activo = false }
  }, [id, router])

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 24px', boxSizing: 'border-box' }}>

        {estado === 'cargando' && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Verificando el enlace…
          </p>
        )}

        {estado === 'sin-sesion' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo>🔑</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Iniciá sesión para ver esta cuenta
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Necesitás una cuenta en Better than Split para acceder a este enlace.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 6 }}>
              <BotonPrimarioLink href={`/login?redirect=${encodeURIComponent(`/cuentas/${id}/acceso`)}`}>
                Iniciar sesión
              </BotonPrimarioLink>
              <BotonSecundarioLink href="/login?modo=crear">
                Crear cuenta
              </BotonSecundarioLink>
            </div>
          </div>
        )}

        {estado === 'invalido' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo negativo>⚠️</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Este enlace ya no es válido
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                La cuenta no existe, o dejó de estar disponible.
              </p>
            </div>
            <div style={{ width: '100%', marginTop: 6 }}>
              <BotonPrimarioLink href="/">Ir al inicio</BotonPrimarioLink>
            </div>
          </div>
        )}

        {estado === 'sin-acceso' && acceso && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo negativo>🔒</IconoCirculo>
            {acceso.es_miembro_del_grupo ? (
              <div>
                <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                  Pedí acceso a un admin
                </h2>
                <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                  Sos parte de <b>{acceso.nombre_grupo}</b>, pero todavía no de esta cuenta. Pedile a un admin de la cuenta que te agregue.
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                  No sos parte de este grupo
                </h2>
                <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                  Pedile a alguien que ya esté adentro que te comparta el código de invitación del grupo.
                </p>
              </div>
            )}
            <div style={{ width: '100%', marginTop: 6 }}>
              <BotonPrimarioLink href="/">Ir al inicio</BotonPrimarioLink>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
