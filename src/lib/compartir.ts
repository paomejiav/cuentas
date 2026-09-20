/**
 * Comparte vía Web Share API si está disponible; si no, copia al
 * portapapeles. Devuelve true cuando el contenido terminó copiado (el
 * llamador debería mostrar un "Copiado ✓"), false cuando lo manejó el
 * share sheet nativo (o el usuario lo canceló — tampoco hace falta feedback).
 */
export async function compartirOCopiar(payload: { title?: string; text: string; url?: string }): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(payload)
    } catch {
      // el usuario canceló el share sheet — no hacemos nada más
    }
    return false
  }
  await navigator.clipboard.writeText(payload.url ?? payload.text)
  return true
}
