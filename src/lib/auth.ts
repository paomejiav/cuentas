import { supabase } from '@/lib/supabase'
import type { Grupo, Integrante } from '@/types/database'

export interface SesionData {
  grupo_id: string
  integrante_id: string
  nombre: string
  grupo_nombre: string
  avatar_color: string
}

const SESSION_KEY = 'cuentas_sesion'

// ============================================================
// Persistencia local
// ============================================================

export function guardarSesionLocal(sesion: SesionData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesion))
  // Cookie liviana para que el middleware pueda verificar sesión
  document.cookie = `cuentas_sesion=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
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
}

// ============================================================
// Unirse a un grupo existente por código
// ============================================================

export async function unirseAGrupo(
  codigoAcceso: string,
  nombre: string
): Promise<{ sesion: SesionData; error: null } | { sesion: null; error: string }> {
  const codigo = codigoAcceso.trim().toUpperCase()
  const nombreLimpio = nombre.trim()

  if (!codigo || !nombreLimpio) {
    return { sesion: null, error: 'Completa todos los campos.' }
  }

  // Buscar el grupo
  const { data: grupoData, error: grupoError } = await supabase
    .from('grupos')
    .select('*')
    .eq('codigo_acceso', codigo)
    .single()

  if (grupoError || !grupoData) {
    return { sesion: null, error: 'Código de grupo incorrecto. Revisá el código e intentá de nuevo.' }
  }

  const grupo = grupoData as import('@/types/database').Grupo

  // Verificar si ya existe una integrante con ese nombre en el grupo
  const { data: existente } = await supabase
    .from('integrantes')
    .select('*')
    .eq('grupo_id', grupo.id)
    .ilike('nombre', nombreLimpio)
    .eq('activo', true)
    .maybeSingle()

  let integrante: Integrante

  if (existente) {
    // Reusar integrante existente (login)
    integrante = existente
  } else {
    // Crear nueva integrante
    const colores = [
      '#F4A79D', '#A8D8B9', '#A8C8E8', '#D4A8D8',
      '#F4D4A0', '#A8D4D4', '#D4C4A8', '#C4D4A8',
    ]
    const { data: integrantesActuales } = await supabase
      .from('integrantes')
      .select('id')
      .eq('grupo_id', grupo.id)

    const colorIdx = (integrantesActuales?.length ?? 0) % colores.length
    const avatarColor = colores[colorIdx]

    const { data: nueva, error: crearError } = await supabase
      .from('integrantes')
      .insert({ grupo_id: grupo.id, nombre: nombreLimpio, avatar_color: avatarColor })
      .select()
      .single()

    if (crearError || !nueva) {
      return { sesion: null, error: 'No se pudo registrar. Intentá de nuevo.' }
    }

    integrante = nueva
  }

  const sesion: SesionData = {
    grupo_id:     grupo.id,
    integrante_id: integrante.id,
    nombre:        integrante.nombre,
    grupo_nombre:  grupo.nombre,
    avatar_color:  integrante.avatar_color,
  }

  guardarSesionLocal(sesion)
  return { sesion, error: null }
}

// ============================================================
// Crear un grupo nuevo
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

  // Generar código único de 6 caracteres
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
    .insert({ grupo_id: grupo.id, nombre, avatar_color: '#F4A79D' })
    .select()
    .single()

  if (intError || !integrante) {
    return { sesion: null, error: 'No se pudo crear tu perfil. Intentá de nuevo.' }
  }

  const sesion: SesionData = {
    grupo_id:     grupo.id,
    integrante_id: integrante.id,
    nombre:        integrante.nombre,
    grupo_nombre:  grupo.nombre,
    avatar_color:  integrante.avatar_color,
  }

  guardarSesionLocal(sesion)
  return { sesion, error: null }
}

// ============================================================
// Obtener sesión activa (verifica que el integrante siga existiendo)
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

  // Fallback con timestamp
  return Date.now().toString(36).toUpperCase().slice(-6)
}
