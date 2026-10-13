// No hay una columna de color por grupo en la base — se asigna en el
// cliente, de forma determinística a partir del id (estable entre pantallas
// y sesiones sin persistir nada nuevo).
export interface ColorGrupo {
  bg: string
  texto: string
}

const PALETA: ColorGrupo[] = [
  { bg: 'var(--tint-cta)', texto: 'var(--color-cta-dark)' }, // violeta (mismo token que Walto)
  { bg: '#FBE7C4', texto: '#B67F0E' }, // ámbar
  { bg: '#FFD0E0', texto: '#D10C54' }, // rosa
  { bg: '#D2E9BC', texto: '#489020' }, // verde
  { bg: '#D5ECFA', texto: '#1EA1EB' }, // celeste
]

export function colorDeGrupo(grupoId: string): ColorGrupo {
  let hash = 0
  for (let i = 0; i < grupoId.length; i++) {
    hash = (hash * 31 + grupoId.charCodeAt(i)) >>> 0
  }
  return PALETA[hash % PALETA.length]
}
