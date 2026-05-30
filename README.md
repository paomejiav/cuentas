# Cuentas 🧾

Gastos compartidos para grupos cerrados de amigas. Sin email, sin contraseña — solo un código de grupo.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · shadcn/ui

---

## Funcionalidades

- **Acceso por código** — cada grupo tiene un código de 6 chars; las integrantes se unen con su nombre
- **Gastos con 3 tipos de división** — partes iguales, montos exactos, o porcentajes
- **Saldos en tiempo real** — Supabase Realtime notifica cuando alguien agrega un gasto
- **Historial filtrable** — por mes, categoría y persona; vista de saldo entre dos personas
- **Cierre mensual** — liquidación con modo optimizado (mínimas transferencias) o individual

---

## Setup local

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd cuentas
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase (ver sección siguiente).

### 3. Levantar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Configurar Supabase

### 1. Crear un proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Anota la **Project URL** y la **anon public key** desde:
   `Settings → API → Project URL / Project API keys`

### 2. Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. Correr las migraciones

En el **SQL Editor** de Supabase, ejecuta en orden:

**Migration 1 — Schema** (`supabase/migrations/002_schema_grupos.sql`):
Crea las 6 tablas: `grupos`, `integrantes`, `gastos`, `divisiones`, `pagos`, `cierres_mensuales`.
Activa Row Level Security con políticas permisivas.

**Migration 2 — Seed opcional** (`supabase/migrations/003_seed_mi_gente_latino.sql`):
Crea el grupo "Mi gente latino" con código `MGL001` e integrantes Jo, Fabi, Naty, Glo y Pao.

### 4. Habilitar Realtime

En Supabase → **Database → Replication**, habilita la tabla `gastos` para recibir cambios en tiempo real.

---

## Variables de entorno

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase | Dashboard → Settings → API |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/       # Pantalla de acceso por código
│   └── (app)/
│       ├── dashboard/      # Saldos + Realtime
│       ├── gastos/nuevo/   # Formulario wizard 2 pasos
│       ├── historial/      # Historial con filtros
│       └── cierre/         # Wizard de cierre mensual (4 pasos)
├── components/app/
│   ├── Avatar.tsx
│   ├── BottomNav.tsx
│   ├── GastoDetalle.tsx    # Bottom sheet de detalle
│   └── Toast.tsx
├── lib/
│   ├── auth.ts             # crearGrupo, unirseAGrupo, sesión
│   ├── balances.ts         # Algoritmos de balance
│   ├── cierre.ts           # calcularResumenMes, cerrarMes
│   ├── format.ts           # formatCLP → "$1.234.567"
│   ├── gastos.ts           # crearGasto, editarGasto, eliminarGasto
│   ├── historial.ts        # Queries con filtros y paginación
│   ├── saldos.ts           # calcularSaldos por par
│   ├── session-store.tsx   # Context + useSession hook
│   └── supabase.ts         # Cliente Supabase
└── types/
    └── database.ts         # Tipos TypeScript del schema
```

---

## Deploy en Vercel

```bash
# Instalar CLI si no la tienes
npm i -g vercel

# Desde la carpeta del proyecto
cd cuentas
vercel --prod
```

Vercel detecta Next.js automáticamente. Configura las variables de entorno en:
**Vercel Dashboard → tu-proyecto → Settings → Environment Variables**

---

## Decisiones de diseño

- **Sin auth por email** — la app es para un grupo cerrado y de confianza; el código de grupo es suficiente
- **Sesión en localStorage + cookie** — el middleware de Next.js lee la cookie para proteger rutas en servidor
- **RLS permisiva** — las políticas de Supabase aceptan todas las peticiones anónimas; apto para grupos privados sin datos sensibles
- **Montos en CLP** — sin decimales, punto como separador de miles (`$1.234.567`)
