import Link from 'next/link'

export default function OnboardingPage() {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Hero de marca */}
        <div style={{
          marginTop: 'max(40px, env(safe-area-inset-top, 0px))',
          height: 340, borderRadius: 32, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(150deg, #8E7DF6, #6F5CE8)',
          boxShadow: '0 24px 48px -20px rgba(111,92,232,.6)',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />

          {/* Tarjeta de saldo flotante */}
          <div style={{
            position: 'absolute', top: 32, left: 22, right: 22,
            background: '#fff', borderRadius: 18, padding: '16px 18px',
            boxShadow: '0 18px 34px -14px rgba(24,34,26,.4)',
          }}>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Saldo del grupo
            </p>
            <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-sora), sans-serif', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
              $72.200
            </p>
            <div style={{ marginTop: 12, height: 10, borderRadius: 7, background: 'var(--color-track)', overflow: 'hidden' }}>
              <div style={{ width: '74%', height: '100%', borderRadius: 7, background: 'repeating-linear-gradient(-45deg, #47C6F4, #47C6F4 5px, #6FD3F7 5px, #6FD3F7 10px)' }} />
            </div>
          </div>

          {/* Píldora flotante */}
          <div style={{
            position: 'absolute', bottom: 84, right: 20,
            background: '#fff', borderRadius: 100, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 12px 24px -10px rgba(24,34,26,.4)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-positive)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-positive)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Fabi te debe
            </span>
          </div>

          {/* Stack de avatares */}
          <div style={{ position: 'absolute', bottom: 26, left: 22, display: 'flex' }}>
            {[
              { i: 'J', bg: '#FACFCA', c: '#E23219' },
              { i: 'F', bg: '#FBE7C4', c: '#B67F0E' },
              { i: 'N', bg: '#D2E9BC', c: '#489020' },
            ].map((a, idx) => (
              <span key={a.i} style={{
                width: 34, height: 34, borderRadius: '50%', marginLeft: idx === 0 ? 0 : -10,
                background: a.bg, color: a.c,
                fontFamily: 'var(--font-sora), sans-serif', fontWeight: 800, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 3px #7A68EE',
              }}>
                {a.i}
              </span>
            ))}
            <span style={{
              width: 34, height: 34, borderRadius: '50%', marginLeft: -10,
              background: 'rgba(255,255,255,.28)', color: '#fff',
              fontFamily: 'var(--font-sora), sans-serif', fontWeight: 700, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 3px #7A68EE',
            }}>
              +2
            </span>
          </div>
        </div>

        {/* Título + subtítulo */}
        <div style={{ flex: 1, textAlign: 'center', paddingTop: 30 }}>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 27, fontWeight: 800,
            letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--color-text-primary)',
          }}>
            Divide gastos<br />sin dramas 🎉
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Registra, divide y salda cuentas con tu grupo en segundos. Nadie queda debiendo de más.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 22 }}>
            <span style={{ width: 22, height: 6, borderRadius: 3, background: 'var(--color-cta)' }} />
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#D6D6DE' }} />
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#D6D6DE' }} />
          </div>
        </div>

        {/* CTAs */}
        <div style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
          <Link
            href="/login?modo=crear"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 54, borderRadius: 15, background: 'var(--gradient-cta)',
              color: 'white', fontSize: 15.5, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif',
              textDecoration: 'none', boxShadow: 'var(--shadow-cta)',
            }}
          >
            Crear cuenta
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', marginTop: 16 }}>
            ¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--color-cta)', fontWeight: 700, textDecoration: 'none' }}>Inicia sesión</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
