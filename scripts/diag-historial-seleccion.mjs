// Diagnóstico de la selección de grupo en Historial (nuevo-inicio).
//
// Levanta Chromium, simula un usuario autenticado con dos grupos (vía mocks
// de Supabase Auth/REST, con latencia artificial e inversión de orden
// configurables), y reproduce los casos (a)-(g) descritos en el diagnóstico,
// registrando en cada paso: cookie, URL, texto del chip, filas mostradas,
// orden de llegada de las respuestas y errores de consola/red.
//
// Requiere: npm install -D playwright (ya agregado), app corriendo en
// http://localhost:3000 (npm run dev), y el bypass temporal de proxy.ts
// activo (header x-diag-bypass: tmp-local-testing-only).
//
// Uso:
//   node scripts/diag-historial-seleccion.mjs <caso> [--invert] [--min=500] [--max=2000]
//   <caso> ∈ a | b | c | d | e | f | g | all

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const PROJECT_REF = 'xehzochrvzxsetnghdgz'
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`
const USER_ID = '11111111-1111-1111-1111-111111111111'
const GRUPO_A = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nombre: 'Grupo A' }
const GRUPO_B = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', nombre: 'Grupo B' }

const args = process.argv.slice(2)
const caso = args.find(a => !a.startsWith('--')) ?? 'a'
const invert = args.includes('--invert')
const minDelay = Number(args.find(a => a.startsWith('--min='))?.split('=')[1] ?? 500)
const maxDelay = Number(args.find(a => a.startsWith('--max='))?.split('=')[1] ?? 2000)

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(sub) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    sub, role: 'authenticated', aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }))
  return `${header}.${payload}.fake-signature`
}

function fakeSessionCookieValue() {
  const session = {
    access_token: fakeJwt(USER_ID),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'diag@example.com', email_confirmed_at: new Date().toISOString(),
      app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    },
  }
  return 'base64-' + base64url(JSON.stringify(session))
}

// ── Estado de llamadas en vuelo, para ver el orden real de llegada ──
const log = []
function registrar(evento, datos) {
  const entrada = { t: Date.now(), evento, ...datos }
  log.push(entrada)
  console.log(`[REPRO] ${evento}`, JSON.stringify(datos))
}

function delayAleatorio() {
  return minDelay + Math.random() * (maxDelay - minDelay)
}

// ── Fixtures REST ──
function filaGrupoMiembro(grupo) {
  return { grupo_id: grupo.id, grupos: { id: grupo.id, nombre: grupo.nombre } }
}

function historialVacio() {
  return { gastos: [], pagos: [] }
}

async function instalarMocks(page, { ordenInvertido, delays }) {
  let contador = 0

  await page.route(`**/auth/v1/user*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: USER_ID, aud: 'authenticated', role: 'authenticated',
        email: 'diag@example.com', app_metadata: {}, user_metadata: {},
      }),
    })
  })

  await page.route(`**/auth/v1/token*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: fakeJwt(USER_ID), token_type: 'bearer', expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'diag@example.com' },
      }),
    })
  })

  await page.route(`**/rest/v1/**`, async route => {
    const req = route.request()
    const url = new URL(req.url())
    const tabla = url.pathname.split('/').pop()
    const idx = contador++
    // Orden de llegada configurable: por defecto, cada llamada demora un
    // tiempo aleatorio en [min,max]. Con --invert, la PRIMERA llamada de
    // cada ronda es la más lenta y las siguientes más rápidas, para forzar
    // que una respuesta "vieja" llegue después de una "nueva".
    let demora
    if (delays && delays[idx] !== undefined) {
      demora = delays[idx]
    } else if (ordenInvertido) {
      demora = idx % 2 === 0 ? maxDelay : minDelay
    } else {
      demora = delayAleatorio()
    }

    registrar('rest-request', { idx, tabla, qs: url.search, demora: Math.round(demora) })
    await new Promise(r => setTimeout(r, demora))

    let body
    const qs = url.search
    if (tabla === 'grupo_miembros' && qs.includes('grupo_id=in.') && qs.includes('usuario_id=neq.')) {
      // cargarDatos (grupo-mode) / listarContactosCompartidos: integrantes de otros usuarios
      body = []
    } else if (tabla === 'grupo_miembros' && qs.includes('grupo_id=in.') && qs.includes('activo=eq.true')) {
      // listarGruposConIntegrantes: conteo de integrantes por grupo
      body = [GRUPO_A.id, GRUPO_B.id].flatMap(id => [{ grupo_id: id }, { grupo_id: id }])
    } else if (tabla === 'grupo_miembros' && qs.includes('usuario_id=eq.') && qs.includes('activo=eq.true')) {
      // listarGruposActivos: select=grupos(id,nombre)
      body = [{ grupos: { id: GRUPO_A.id, nombre: GRUPO_A.nombre } }, { grupos: { id: GRUPO_B.id, nombre: GRUPO_B.nombre } }]
    } else if (tabla === 'grupo_miembros') {
      // listarGruposDeUsuario (obtenerSeleccion / resolverGrupoActivo): select=grupo_id,grupos(id,nombre)
      body = [filaGrupoMiembro(GRUPO_A), filaGrupoMiembro(GRUPO_B)]
    } else if (tabla === 'gastos' || tabla === 'pagos') {
      body = []
    } else if (tabla === 'usuarios') {
      body = []
    } else {
      body = []
    }

    registrar('rest-response', { idx, tabla })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function leerEstado(page) {
  const url = page.url()
  const cookies = await page.context().cookies()
  const cookieSeleccion = cookies.find(c => c.name === 'ultimo_grupo_activo')?.value ?? null
  const chip = await page.getByRole('button', { name: 'Cambiar de grupo' }).textContent().catch(() => null)
  const filas = await page.locator('main button, main a, main [class]').count().catch(() => -1)
  const vacio = await page.getByText('Sin movimientos', { exact: false }).count().catch(() => 0)
  return { url, cookieSeleccion, chip: chip?.trim() ?? null, filas, vacio: vacio > 0 }
}

async function paso(page, nombre) {
  const estado = await leerEstado(page)
  registrar('paso', { nombre, ...estado })
  return estado
}

async function abrirSheetYElegir(page, idOTodos) {
  await page.getByRole('button', { name: 'Cambiar de grupo' }).click()
  await page.waitForTimeout(150)
  const opcion = idOTodos === 'todos'
    ? page.getByText('Todos los grupos', { exact: false }).first()
    : page.getByText(idOTodos === GRUPO_A.id ? GRUPO_A.nombre : GRUPO_B.nombre, { exact: false }).first()
  try {
    await opcion.click({ timeout: 5000 })
  } catch {
    const box = await opcion.boundingBox().catch(() => null)
    const elAtPoint = box ? await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el ? { tag: el.tagName, cls: el.className, zIndex: getComputedStyle(el).zIndex, pos: getComputedStyle(el).position, text: el.textContent?.slice(0, 60) } : null
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }) : null
    registrar('click-fallo', { box, elAtPoint })
    await opcion.click({ timeout: 5000, force: true })
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  // UI mobile-first (max-width 440px) — un viewport de escritorio deja el
  // sheet y otros overlays con problemas de layout ajenos al bug real.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })

  await context.addCookies([{
    name: AUTH_COOKIE, value: fakeSessionCookieValue(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }])
  await context.setExtraHTTPHeaders({ 'x-diag-bypass': 'tmp-local-testing-only' })

  const page = await context.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().startsWith('[DIAG]')) {
      registrar('console', { type: msg.type(), text: msg.text() })
    }
  })
  page.on('requestfailed', req => registrar('request-failed', { url: req.url(), error: req.failure()?.errorText }))
  page.on('pageerror', err => registrar('page-error', { message: err.message }))

  await instalarMocks(page, { ordenInvertido: invert })

  console.log(`\n=== Caso ${caso} (invert=${invert}, delays=[${minDelay},${maxDelay}]ms) ===\n`)

  if (caso === 'a' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await paso(page, 'a.1 inicio en Todos')
    await page.waitForTimeout(maxDelay + 500)
    await paso(page, 'a.2 Todos estabilizado')

    await abrirSheetYElegir(page, GRUPO_A.id)
    await page.waitForURL(url => url.href.includes('grupo='), { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(maxDelay + 500)
    await paso(page, 'a.3 tras elegir Grupo A')

    await abrirSheetYElegir(page, 'todos')
    await page.waitForTimeout(50)
    await paso(page, 'a.4 inmediatamente tras volver a Todos')
    await page.waitForTimeout(2 * maxDelay + 1000)
    await paso(page, 'a.5 Todos estabilizado tras volver')
  }

  if (caso === 'c' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await page.waitForTimeout(maxDelay + 500)
    const secuencia = [GRUPO_A.id, 'todos', GRUPO_B.id, 'todos', GRUPO_A.id, GRUPO_B.id, 'todos', GRUPO_A.id, 'todos', GRUPO_B.id]
    for (let i = 0; i < secuencia.length; i++) {
      await abrirSheetYElegir(page, secuencia[i])
      await page.waitForTimeout(150)
      await paso(page, `c.${i + 1} cambio #${i + 1} -> ${secuencia[i]}`)
    }
    await page.waitForTimeout(3 * maxDelay + 1000)
    await paso(page, 'c.final tras estabilizar')
  }

  await page.waitForTimeout(200)
  await browser.close()

  console.log('\n=== Resumen de requests REST (orden de llegada) ===')
  log.filter(l => l.evento === 'rest-response').forEach(l => console.log(`  #${l.idx} ${l.tabla} respondió en t=${l.t}`))

  console.log('\n=== Log completo (JSON) ===')
  console.log(JSON.stringify(log, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
