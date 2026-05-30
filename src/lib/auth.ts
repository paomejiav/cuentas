import { supabase } from '@/lib/supabase'
import type { Grupo, Integrante } from '@/types/database'

export interface SesionData {
  grupo_id: string
  integrante_id: string
  nombre: string
  grupo_nombre: string
  avatar_color: string
  es_admin: boolean
}

const SESSION_KEY = 'cuentas_sesion'
const MAX_AGE = 60 * 60 * 24 * 30

// ============================================================
// Persistencia local
// ============================================================

export function guardarSesionLocal(sesion: SesionData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesion))
  document.cookie = `cuentas_sesion=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`
  if (sesion.es_admin) {
    document.cookie = `cuentas_admin=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`
  } else {
    document.cookie = 'cuentas_admin=; path=/; max-age=0'
  }
}

export function leerSesionLocal(): SesionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SesionData) : null
  } catch {
    return null
  }
}

export function borrarSesionLocal(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  document.cookie = 'cuentas_sesion=; path=/; max-age=0'
  document.cookie = 'cuentas_admin=; path=/; max-age=0'
}

// ============================================================
// PASO 1 — Verificar código y obtener integrantes del grupo
// ============================================================

export async function verificarCodigo(codigoAcceso: string): Promise<
  | { grupo: Grupo; integrantes: Integrante[]; error: null }
  | { grupo: null; integrantes: null; error: string }
> {
  const codigo = codigoAcceso.trim().toUpperCase()
  if (!codigo) return { grupo: null, integrantes: null, error: 'Ingresa el código del grupo.' }

  const { data: grupoData, error: grupoError } = await supabase
    .from('grupos')
    .select('*')
    .eq('codigo_acceso', codigo)
    .single()

  if (grupoError || !grupoData) {
    return { grupo: null, integrantes: null, error: 'Código incorrecto, revísalo.' }
  }

  const grupo = grupoData as Grupo

  const { data: integrantesData } = await supabase
    .from('integrantes')
    .select('*')
    .eq('grupo_id', grupo.id)
    .eq('activo', true)
    .order('nombre')

  return {
    grupo,
    integrantes: (integrantesData ?? []) as Integrante[],
    error: null,
  }
}

// ============================================================
// PASO 2 — Seleccionar integrante y crear sesión
// ============================================================

export function seleccionarIntegrante(grupo: Grupo, integrante: Integrante): SesionData {
  const sesion: SesionData = {
    grupo_id:      grupo.id,
    integrante_id: integrante.id,
    nombre:        integrante.nombre,
    grupo_nombre:  grupo.nombre,
    avatar_color:  integrante.avatar_color,
    es_admin:      integrante.es_admin ?? false,
  }
  guardarSesionLocal(sesion)
  return sesion
}

// ============================================================
// Crear un grupo nuevo (flujo de creación, no de login)
// ============================================================

export async function crearGrupo(
  nombreGrupo: string,
  nombreIntegrante: string
): Promise<{ sesion: SesionData; error: null } | { sesion: null; error: string }> {
  const grupo_nombre = nombreGrupo.trim()
  const nombre = nombreIntegrante.trim()

  if (!grupo_nombre || !nombre) {
    return { sesion: null, error: 'Completa todos los campos.' }
  }

  const codigo = await generarCodigoUnico()

  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .insert({ nombre: grupo_nombre, codigo_acceso: codigo })
    .select()
    .single()

  if (grupoError || !grupo) {
    return { sesion: null, error: 'No se pudo crear el grupo. Intentá de nuevo.' }
  }

  const { data: integrante, error: intError } = await supabase
    .from('integrantes')
    .insert({ grupo_id: grupo.id, nombre, avatar_color: '#F4A79D', es_admin: true })
    .select()
    .single()

  if (intError || !integrante) {
    return { sesion: null, error: 'No se pudo crear tu perfil. Intentá de nuevo.' }
  }

  const sesion = seleccionarIntegrante(grupo as Grupo, integrante as Integrante)
  return { sesion, error: null }
}

// ============================================================
// Verificar sesión activa
// ============================================================

export async function obtenerSesion(): Promise<SesionData | null> {
  const local = leerSesionLocal()
  if (!local) return null

  const { data } = await supabase
    .from('integrantes')
    .select('id, activo')
    .eq('id', local.integrante_id)
    .single()

  if (!data || !data.activo) {
    borrarSesionLocal()
    return null
  }

  return local
}

// ============================================================
// Cerrar sesión
// ============================================================

export function cerrarSesion(): void {
  borrarSesionLocal()
}

// ============================================================
// Helpers
// ============================================================

async function generarCodigoUnico(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let intentos = 0

  while (intentos < 10) {
    const codigo = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    const { data } = await supabase
      .from('grupos')
      .select('id')
      .eq('codigo_acceso', codigo)
      .maybeSingle()

    if (!data) return codigo
    intentos++
  }

  return Date.now().toString(36).toUpperCase().slice(-6)
}
