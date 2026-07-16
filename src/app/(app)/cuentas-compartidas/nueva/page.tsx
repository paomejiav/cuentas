'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import { crearCuentaCompartida, validarCuentaCompartida } from '@/lib/cuentas-compartidas'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'
import type { Integrante } from '@/types/database'

// ── Estilos compartidos ─────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'var(--color-card-light)',
  border: 'none',
  borderRadius: 14,
  height: 52,
  padding: '0 16px',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  fontSize: 15,
  color: 'var(--color-text-primary)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.outline = '2px solid var(--color-cta)'
  e.target.style.background = 'white'
}
function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.outline = 'none'
  e.target.style.background = 'var(--color-card-light)'
}

// ── Sub-componentes ──────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block', margin: '0 0 8px',
        fontSize: 12, fontWeight: 600,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        cursor: htmlFor ? 'pointer' : 'default',
      }}
    >
      {children}
    </label>
  )
}

function ErrorMsg({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      style={{
        margin: '6px 0 0', fontSize: 12,
        color: 'var(--color-negative)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span aria-hidden="true">⚠</span> {mensaje}
    </p>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 24 }}>{children}</div>
}

// ── Página principal ─────────────────────────────────────────

export default function NuevaCuentaCompartidaPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [cargandoIntegrantes, setCargandoIntegrantes] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [participantes, setParticipantes] = useState<string[]>([])
  const [pagadoPor, setPagadoPor] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  // Cargar integrantes del grupo
  useEffect(() => {
    if (!sesion) return
    supabase
      .from('integrantes')
      .select('*')
      .eq('grupo_id', sesion.grupo_id)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) setIntegrantes(data as Integrante[])
        setCargandoIntegrantes(false)
      })
  }, [sesion])

  // Si el pagador deja de ser participante, limpiar la selección
  useEffect(() => {
    if (pagadoPor && !participantes.includes(pagadoPor)) {
      setPagadoPor('')
    }
  }, [participantes, pagadoPor])

  function toggleParticipante(id: string) {
    setParticipantes(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null
    setFoto(archivo)
    setFotoPreview(archivo ? URL.createObjectURL(archivo) : null)
  }

  function quitarFoto() {
    setFoto(null)
    setFotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCrear() {
    const errs = validarCuentaCompartida({ nombre, participantes, pagado_por: pagadoPor })
    if (errs.length > 0) {
      const map: Record<string, string> = {}
      errs.forEach(e => { map[e.campo] = e.mensaje })
      setErrores(map)
      return
    }
    setErrores({})
    setGuardando(true)

    const result = await crearCuentaCompartida({
      grupo_id:      sesion!.grupo_id,
      nombre,
      fecha,
      pagado_por:    pagadoPor,
      participantes,
      creado_por:    sesion!.integrante_id,
      foto,
    })

    setGuardando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: '¡Cuenta compartida creada! 🎉', tipo: 'exito' })
    setTimeout(() => router.push(`/cuentas-compartidas/${result.id}/items`), 900)
  }

  if (sesionLoading || !sesion) return null

  // ── RENDER ────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 20,
          paddingLeft: 'var(--page-px)',
          paddingRight: 'var(--page-px)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <button
            onClick={() => router.back()}
            aria-label="Volver"
            style={{
              background: 'var(--color-card)',
              border: 'none',
              borderRadius: 12,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Cuenta compartida
            </p>
            <h1 style={{
              margin: '2px 0 0',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              Nueva cuenta
            </h1>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {/* Nombre */}
          <Section>
            <Label htmlFor="input-nombre">Nombre</Label>
            <input
              id="input-nombre"
              type="text"
              placeholder="Ej. Cena cumpleaños Naty"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              aria-invalid={!!errores.nombre}
              style={inputBase}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errores.nombre && <ErrorMsg mensaje={errores.nombre} />}
          </Section>

          {/* Fecha */}
          <Section>
            <Label htmlFor="input-fecha">Fecha</Label>
            <input
              id="input-fecha"
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={inputBase}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </Section>

          {/* Participantes */}
          <Section>
            <Label>¿Quiénes participan?</Label>
            {cargandoIntegrantes ? (
              <div style={{ height: 52, background: 'var(--color-card)', borderRadius: 14 }} />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {integrantes.map(i => {
                  const activo = participantes.includes(i.id)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => toggleParticipante(i.id)}
                      aria-pressed={activo}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px 8px 10px',
                        borderRadius: 100,
                        border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
                        background: activo ? 'white' : 'var(--color-card-light)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Avatar nombre={i.nombre} color={i.avatar_color} size={28} />
                      <span style={{
                        fontSize: 13,
                        fontWeight: activo ? 600 : 400,
                        color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}>
                        {i.nombre}
                      </span>
                      {activo && <span style={{ fontSize: 14, marginLeft: -2 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {errores.participantes && <ErrorMsg mensaje={errores.participantes} />}
          </Section>

          {/* Pagador */}
          <Section>
            <Label htmlFor="select-pagador">¿Quién pagó?</Label>
            <select
              id="select-pagador"
              value={pagadoPor}
              onChange={e => setPagadoPor(e.target.value)}
              disabled={participantes.length === 0}
              aria-invalid={!!errores.pagado_por}
              style={{
                ...inputBase,
                appearance: 'none',
                cursor: participantes.length === 0 ? 'not-allowed' : 'pointer',
                opacity: participantes.length === 0 ? 0.6 : 1,
              }}
              onFocus={focusInput}
              onBlur={blurInput}
            >
              <option value="">
                {participantes.length === 0 ? 'Seleccioná participantes primero' : 'Elegí quién pagó'}
              </option>
              {integrantes
                .filter(i => participantes.includes(i.id))
                .map(i => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}{i.id === sesion.integrante_id ? ' (tú)' : ''}
                  </option>
                ))}
            </select>
            {errores.pagado_por && <ErrorMsg mensaje={errores.pagado_por} />}
          </Section>

          {/* Foto de la boleta */}
          <Section>
            <Label>Foto de la boleta (opcional)</Label>
            {fotoPreview ? (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoPreview}
                  alt="Vista previa de la boleta"
                  style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={quitarFoto}
                  aria-label="Quitar foto"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(28,43,26,0.7)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  height: 96,
                  borderRadius: 16,
                  border: '2px dashed var(--color-border)',
                  background: 'var(--color-card-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 22 }}>📷</span>
                <span style={{
                  fontSize: 13, color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  Subir foto de la boleta
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              style={{ display: 'none' }}
            />
          </Section>

          {/* CTA Crear */}
          <button
            onClick={handleCrear}
            disabled={guardando}
            aria-busy={guardando}
            style={{
              width: '100%', height: 56, borderRadius: 100,
              background: guardando ? 'var(--color-cta-dark)' : 'var(--color-cta)',
              color: 'white', border: 'none',
              fontSize: 16, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: guardando ? 'not-allowed' : 'pointer',
              transition: 'all 120ms ease', marginTop: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
            onPointerDown={e => { if (!guardando) e.currentTarget.style.transform = 'scale(0.97)' }}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {guardando && <span className="spinner" aria-hidden="true" />}
            {guardando ? 'Creando…' : 'Crear cuenta'}
          </button>
        </main>
      </div>

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
