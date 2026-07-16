import { Avatar } from '@/components/app/Avatar'
import { formatCLP } from '@/lib/format'
import type { ResumenPersona } from '@/lib/cuentas-compartidas'

interface ResumenPersonasProps {
  personas: ResumenPersona[]
  nombresExentos: string[]
}

export function ResumenPersonas({ personas, nombresExentos }: ResumenPersonasProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {personas.map(p => (
        <div
          key={p.integrante.id}
          style={{
            background: 'var(--color-card)', borderRadius: 16, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: p.es_exento ? 0.7 : 1,
          }}
        >
          <Avatar nombre={p.integrante.nombre} color={p.integrante.avatar_color} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textDecoration: p.es_exento ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.integrante.nombre}
              </p>
              {p.es_exento && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)',
                  background: 'var(--color-card-light)', borderRadius: 100, padding: '2px 8px',
                  fontFamily: 'var(--font-dm-sans), sans-serif', flexShrink: 0,
                }}>
                  NO PAGA
                </span>
              )}
            </div>

            {p.es_exento ? (
              <p style={{
                margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                Su consumo se repartió entre el resto
              </p>
            ) : (
              <p style={{
                margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                Consumo {formatCLP(p.consumo_bruto)}
                {p.extra_por_exentos > 0.5 && (
                  <> · + parte de {nombresExentos.join(', ')} {formatCLP(p.extra_por_exentos)}</>
                )}
                {p.propina > 0.5 && <> · propina {formatCLP(p.propina)}</>}
              </p>
            )}
          </div>

          <span style={{
            fontSize: 18, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
            flexShrink: 0,
          }}>
            {formatCLP(p.total_final)}
          </span>
        </div>
      ))}
    </div>
  )
}
