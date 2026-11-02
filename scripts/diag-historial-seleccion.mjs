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
//   node scripts/diag-historial-seleccion.mjs <caso> [--invert] [--min=500] [--max=2000] [--n=30]
//   <caso> ∈ a | b | c | d | e | f | g | all | stress-a | stress-c | symptom2

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
const n = Number(args.find(a => a.startsWith('--n='))?.split('=')[1] ?? 30)

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

// Un gasto reconocible por grupo (y uno "personal", sin grupo) para poder
// verificar CONTENIDO real — no solo que la UI no truene — y así detectar
// si "Todos" realmente mezcla los 3 orígenes o se queda pegado con menos
// (el síntoma original: faltaban los gastos de grupo, solo quedaba lo
// personal, porque el fetch prematuro corría con gruposActivos=[]).
function filaGasto(id, descripcion) {
  return {
    id, descripcion, monto_total: 1000, categoria: 'otro',
    fecha: '2026-01-01', creado_en: '2026-01-01T00:00:00Z',
    cuenta_id: null, pagado_por: USER_ID,
    cuentas: null, usuarios: { id: USER_ID, nombre: 'Yo', avatar_color: '#000' },
    divisiones: [],
  }
}

const GASTO_A = 'Super A'
const GASTO_B = 'Super B'
const GASTO_PERSONAL = 'Personal X'
const DESCRIPCIONES_ESPERADAS = [GASTO_A, GASTO_B, GASTO_PERSONAL]

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
    } else if (tabla === 'grupo_miembros' && qs.includes('select=grupo_id&') && qs.includes('usuario_id=eq.') && qs.includes('activo=eq.true')) {
      // listarContactosCompartidos (1ra sub-consulta): select=grupo_id — plano,
      // NO confundir con listarGruposActivos (select=grupos(...), anidado) aunque
      // comparten el resto del query string.
      body = [{ grupo_id: GRUPO_A.id }, { grupo_id: GRUPO_B.id }]
    } else if (tabla === 'grupo_miembros' && qs.includes('usuario_id=eq.') && qs.includes('activo=eq.true')) {
      // listarGruposActivos: select=grupos(id,nombre)
      body = [{ grupos: { id: GRUPO_A.id, nombre: GRUPO_A.nombre } }, { grupos: { id: GRUPO_B.id, nombre: GRUPO_B.nombre } }]
    } else if (tabla === 'grupo_miembros') {
      // listarGruposDeUsuario (obtenerSeleccion / resolverGrupoActivo): select=grupo_id,grupos(id,nombre)
      body = [filaGrupoMiembro(GRUPO_A), filaGrupoMiembro(GRUPO_B)]
    } else if (tabla === 'gastos' && qs.includes(`grupo_id=eq.${GRUPO_A.id}`)) {
      body = [filaGasto('gasto-a1', GASTO_A)]
    } else if (tabla === 'gastos' && qs.includes(`grupo_id=eq.${GRUPO_B.id}`)) {
      body = [filaGasto('gasto-b1', GASTO_B)]
    } else if (tabla === 'gastos' && qs.includes('grupo_id=is.null')) {
      body = [filaGasto('gasto-p1', GASTO_PERSONAL)]
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
  const cargando = await page.getByText('Cargando', { exact: false }).count().catch(() => 0)
  const visibles = []
  for (const d of DESCRIPCIONES_ESPERADAS) {
    const n = await page.getByText(d, { exact: false }).count().catch(() => 0)
    if (n > 0) visibles.push(d)
  }
  return { url, cookieSeleccion, chip: chip?.trim() ?? null, filas, vacio: vacio > 0, cargando: cargando > 0, visibles }
}

// Espera activa a que desaparezca cualquier indicador de "cargando", en vez
// de un sleep fijo — mucho más confiable bajo latencia aleatoria por
// petición, donde la cadena total puede variar bastante entre corridas.
async function esperarEstable(page, { timeout = 15000 } = {}) {
  const inicio = Date.now()
  while (Date.now() - inicio < timeout) {
    const cargando = await page.getByText('Cargando', { exact: false }).count().catch(() => 0)
    if (cargando === 0) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function paso(page, nombre) {
  const estado = await leerEstado(page)
  registrar('paso', { nombre, ...estado })
  return estado
}

// Correctness check para el modo "Todos" (mixto): deben verse los 3
// orígenes (grupo A, grupo B, personal). Si falta alguno, es el síntoma
// original: el fetch prematuro con gruposActivos=[] congeló un snapshot
// incompleto.
function todosCorrecto(estado) {
  return DESCRIPCIONES_ESPERADAS.every(d => estado.visibles.includes(d))
}

// El contenido esperado para cada destino, no solo la URL: la URL cambia
// instantáneo (pushState), pero el contenido tarda lo que tarde la red —
// mientras tanto la pantalla sigue mostrando el snapshot VIEJO (sin ningún
// indicador de "Cargando", porque fase/cargandoDatos no se resetean al
// navegar entre grupos). Confirmar solo la URL daba falsos positivos.
function contenidoEsperado(estado, idOTodos) {
  if (idOTodos === 'todos') {
    return todosCorrecto(estado) && !!estado.chip?.includes('Todos los grupos')
  }
  const nombre = idOTodos === GRUPO_A.id ? 'Grupo A' : 'Grupo B'
  const propia = idOTodos === GRUPO_A.id ? GASTO_A : GASTO_B
  const otra = idOTodos === GRUPO_A.id ? GASTO_B : GASTO_A
  return !!estado.chip?.includes(nombre) && estado.visibles.includes(propia) && !estado.visibles.includes(otra) && !estado.visibles.includes(GASTO_PERSONAL)
}

async function esperarCondicion(page, predicado, { timeout = 15000 } = {}) {
  const inicio = Date.now()
  let ultimo = null
  while (Date.now() - inicio < timeout) {
    ultimo = await leerEstado(page)
    if (predicado(ultimo)) return { ok: true, estado: ultimo }
    await page.waitForTimeout(100)
  }
  return { ok: false, estado: ultimo }
}

async function esperarContenido(page, idOTodos, { timeout = 15000 } = {}) {
  const inicio = Date.now()
  let ultimo = null
  while (Date.now() - inicio < timeout) {
    ultimo = await leerEstado(page)
    if (contenidoEsperado(ultimo, idOTodos)) return { ok: true, estado: ultimo }
    await page.waitForTimeout(100)
  }
  return { ok: false, estado: ultimo }
}

function urlCoincide(url, idOTodos) {
  return idOTodos === 'todos' ? /grupo=todos(&|$)/.test(url) : url.includes(`grupo=${idOTodos}`)
}

// Elige una opción del sheet y VERIFICA que la URL realmente cambió al
// destino esperado — no basta con que el click "no haya tirado error": ya
// vimos clicks que no producen ningún cambio de estado. Reintenta hasta 3
// veces (reabriendo el sheet) antes de darse por vencido.
async function abrirSheetYElegir(page, idOTodos, { intentos = 3 } = {}) {
  for (let intento = 1; intento <= intentos; intento++) {
    const urlAntes = page.url()
    await page.getByRole('button', { name: 'Cambiar de grupo' }).click()
    // Por rol de botón, no por texto plano: "Grupo A"/"Grupo B" también
    // aparecen como etiqueta de origen (TagGrupoHistorial) en cada fila del
    // modo mixto, detrás del backdrop — getByText ambiguaba con eso.
    const opcion = idOTodos === 'todos'
      ? page.getByRole('button', { name: /Todos los grupos/ })
      : page.getByRole('button', { name: idOTodos === GRUPO_A.id ? /Grupo A/ : /Grupo B/ })
    try {
      await opcion.waitFor({ state: 'visible', timeout: 5000 })
    } catch {
      registrar('sheet-no-abrio', { intento, idOTodos })
      await page.keyboard.press('Escape').catch(() => {})
      continue
    }
    try {
      await opcion.click({ timeout: 3000 })
    } catch {
      const box = await opcion.boundingBox().catch(() => null)
      const diag = await page.evaluate((pt) => {
        const fixedDivs = Array.from(document.querySelectorAll('div')).filter(d => getComputedStyle(d).position === 'fixed')
        const elAtPoint = pt ? document.elementFromPoint(pt.x, pt.y) : null
        return {
          backdrops: fixedDivs.map(d => ({ zIndex: getComputedStyle(d).zIndex, text: d.textContent?.slice(0, 50), rect: d.getBoundingClientRect().toJSON() })),
          elAtPoint: elAtPoint ? { tag: elAtPoint.tagName, zIndex: getComputedStyle(elAtPoint).zIndex, pos: getComputedStyle(elAtPoint).position, text: elAtPoint.textContent?.slice(0, 60) } : null,
        }
      }, box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null)
      registrar('click-fallo', { intento, box, ...diag })
      await opcion.click({ timeout: 3000, force: true }).catch(() => {})
    }
    // Confirmar que la URL cambió (el click registró) y luego que el
    // CONTENIDO realmente refleja el destino — la URL cambia al instante
    // (pushState) pero el contenido tarda lo que tarde la red, y mientras
    // tanto la pantalla sigue mostrando el snapshot viejo sin ningún
    // indicador de "Cargando" (fase/cargandoDatos no se resetean al
    // navegar entre grupos). Confirmar solo la URL daba falsos positivos.
    try {
      await page.waitForFunction(
        ({ destino }) => {
          const url = location.href
          return destino === 'todos' ? /grupo=todos(&|$)/.test(url) : url.includes(`grupo=${destino}`)
        },
        { destino: idOTodos },
        { timeout: 4000 }
      )
    } catch {
      registrar('seleccion-no-cambio', { intento, idOTodos, urlAntes, urlDespues: page.url() })
      if (intento === intentos) return false
      continue
    }
    const { ok, estado } = await esperarContenido(page, idOTodos, { timeout: 4 * maxDelay + 4000 })
    if (ok) return true
    registrar('contenido-no-cambio', { intento, idOTodos, estado })
    if (intento === intentos) return false
  }
  return false
}

async function nuevaPagina(browser, { ordenInvertido = false, silencioso = false } = {}) {
  // UI mobile-first (max-width 440px) — un viewport de escritorio deja el
  // sheet y otros overlays con problemas de layout ajenos al bug real.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })

  await context.addCookies([{
    name: AUTH_COOKIE, value: fakeSessionCookieValue(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }])
  await context.setExtraHTTPHeaders({ 'x-diag-bypass': 'tmp-local-testing-only' })

  const page = await context.newPage()
  if (!silencioso) {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().startsWith('[DIAG]')) {
        registrar('console', { type: msg.type(), text: msg.text() })
      }
    })
    page.on('requestfailed', req => registrar('request-failed', { url: req.url(), error: req.failure()?.errorText }))
    page.on('pageerror', err => registrar('page-error', { message: err.message }))
  }

  await instalarMocks(page, { ordenInvertido })
  return { context, page }
}

// ── Estrés: repetir (a) N veces, cada vez con una página/contexto nuevo
// (equivalente a recargar desde cero) y latencias aleatorias POR PETICIÓN
// (no solo por "ronda"), para maximizar la variación de orden de llegada.
async function stressA(browser) {
  let ok = 0
  const fallas = []
  for (let i = 0; i < n; i++) {
    const { context, page } = await nuevaPagina(browser, { silencioso: true })
    try {
      await page.goto(`${BASE}/historial?grupo=todos`)
      await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
      await abrirSheetYElegir(page, GRUPO_A.id)
      await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
      await abrirSheetYElegir(page, 'todos')
      await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
      const estado = await leerEstado(page)
      const pasa = todosCorrecto(estado) && estado.chip?.includes('Todos los grupos')
      if (pasa) ok++
      else fallas.push({ i, estado })
    } catch (e) {
      fallas.push({ i, error: String(e) })
    } finally {
      await context.close()
    }
  }
  console.log(`\n[STRESS a] ${ok}/${n} correctos`)
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2))
  await browser.close()
}

async function stressC(browser) {
  let ok = 0
  const fallas = []
  const secuencia = [GRUPO_A.id, 'todos', GRUPO_B.id, 'todos', GRUPO_A.id, GRUPO_B.id, 'todos', GRUPO_A.id, 'todos', GRUPO_B.id]
  for (let i = 0; i < n; i++) {
    const { context, page } = await nuevaPagina(browser, { silencioso: true })
    try {
      await page.goto(`${BASE}/historial?grupo=todos`)
      await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
      for (const dest of secuencia) {
        await abrirSheetYElegir(page, dest)
        await page.waitForTimeout(100 + Math.random() * 300)
      }
      await esperarEstable(page, { timeout: 4 * maxDelay + 4000 })
      const estado = await leerEstado(page)
      // La secuencia termina en Grupo B: debe mostrar SOLO lo de B (no mixto).
      const pasa = estado.chip?.includes('Grupo B') && estado.visibles.includes(GASTO_B) && !estado.visibles.includes(GASTO_A)
      if (pasa) ok++
      else fallas.push({ i, estado })
    } catch (e) {
      fallas.push({ i, error: String(e) })
    } finally {
      await context.close()
    }
  }
  console.log(`\n[STRESS c] ${ok}/${n} correctos (10 cambios alternando)`)
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2))
  await browser.close()
}

// ── Intentos de reproducir el síntoma 2 ("el selector deja de cambiar") ──
async function intentarSymptom2(browser) {
  const { context, page } = await nuevaPagina(browser, { ordenInvertido: invert })
  const resultados = []

  async function selectorResponde(etiqueta) {
    const antes = await leerEstado(page)
    await abrirSheetYElegir(page, antes.url.includes('grupo=' + GRUPO_A.id) ? GRUPO_B.id : GRUPO_A.id)
    await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
    const despues = await leerEstado(page)
    const cambio = despues.url !== antes.url || despues.chip !== antes.chip
    resultados.push({ etiqueta, antes, despues, cambio })
    registrar('symptom2-check', { etiqueta, cambio })
    return cambio
  }

  await page.goto(`${BASE}/historial?grupo=todos`)
  await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })

  // 1. Varios cambios con fetch en vuelo (sin esperar), seguidos de un cambio
  //    normal con espera completa, para ver si el selector "se recupera".
  for (let i = 0; i < 6; i++) {
    const destino = i % 2 === 0 ? GRUPO_A.id : GRUPO_B.id
    await abrirSheetYElegir(page, destino)
    await page.waitForTimeout(80) // deliberadamente corto: no espera resolución
  }
  await selectorResponde('tras 6 cambios en caliente')

  // 2. Abrir el sheet y cerrarlo sin elegir (click en el backdrop), repetido,
  //    para ver si deja el sheet en un estado que bloquee el próximo click.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Cambiar de grupo' }).click()
    await page.waitForTimeout(100)
    await page.mouse.click(5, 5) // esquina, fuera del panel -> backdrop
    await page.waitForTimeout(100)
  }
  await selectorResponde('tras abrir/cerrar el sheet sin elegir, 3 veces')

  // 3. Tocar una fila de grupo en el sheet MIENTRAS la respuesta anterior
  //    (todavía en vuelo) no ha llegado.
  await abrirSheetYElegir(page, GRUPO_A.id)
  await page.waitForTimeout(50) // la anterior sigue en vuelo
  await abrirSheetYElegir(page, GRUPO_B.id)
  await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
  await selectorResponde('tocar otra fila mientras la anterior seguía en vuelo')

  // 4. Caída breve de red (todas las requests de Supabase fallan) que luego
  //    se recupera.
  await page.route('**/rest/v1/**', route => route.abort('failed'))
  await abrirSheetYElegir(page, GRUPO_A.id)
  await page.waitForTimeout(1500)
  await page.unroute('**/rest/v1/**')
  await instalarMocks(page, { ordenInvertido: invert })
  await selectorResponde('tras una caída de red que luego se recupera')

  const fallidos = resultados.filter(r => !r.cambio)
  console.log(`\n[SYMPTOM2] ${resultados.length - fallidos.length}/${resultados.length} veces el selector SÍ respondió tras el estrés`)
  if (fallidos.length) {
    console.log('Casos donde NO cambió:')
    console.log(JSON.stringify(fallidos, null, 2))
  } else {
    console.log('No se logró reproducir el bloqueo: el selector respondió en todos los intentos de estrés probados.')
  }
  await context.close()
  await browser.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  if (caso === 'stress-a') return await stressA(browser)
  if (caso === 'stress-c') return await stressC(browser)
  if (caso === 'symptom2') return await intentarSymptom2(browser)

  const { context, page } = await nuevaPagina(browser, { ordenInvertido: invert })

  console.log(`\n=== Caso ${caso} (invert=${invert}, delays=[${minDelay},${maxDelay}]ms) ===\n`)

  if (caso === 'a' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await paso(page, 'a.1 inicio en Todos')
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'a.2 Todos estabilizado')

    await abrirSheetYElegir(page, GRUPO_A.id)
    await page.waitForURL(url => url.href.includes('grupo='), { timeout: 5000 }).catch(() => {})
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'a.3 tras elegir Grupo A')

    await abrirSheetYElegir(page, 'todos')
    await page.waitForTimeout(50)
    await paso(page, 'a.4 inmediatamente tras volver a Todos')
    await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
    const finA = await paso(page, 'a.5 Todos estabilizado tras volver')
    console.log(`[VEREDICTO] a: ${todosCorrecto(finA) ? 'OK' : 'FALLA'}`)
  }

  if (caso === 'c' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    const secuencia = [GRUPO_A.id, 'todos', GRUPO_B.id, 'todos', GRUPO_A.id, GRUPO_B.id, 'todos', GRUPO_A.id, 'todos', GRUPO_B.id]
    for (let i = 0; i < secuencia.length; i++) {
      await abrirSheetYElegir(page, secuencia[i])
      await page.waitForTimeout(150)
      await paso(page, `c.${i + 1} cambio #${i + 1} -> ${secuencia[i]}`)
    }
    await esperarEstable(page, { timeout: 4 * maxDelay + 4000 })
    const finC = await paso(page, 'c.final tras estabilizar')
    console.log(`[VEREDICTO] c: ${contenidoEsperado(finC, GRUPO_B.id) ? 'OK' : 'FALLA'} (secuencia termina en Grupo B)`)
  }

  // (b) Todos -> A -> B -> Todos
  if (caso === 'b' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'b.1 inicio en Todos')

    await abrirSheetYElegir(page, GRUPO_A.id)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'b.2 tras elegir Grupo A')

    await abrirSheetYElegir(page, GRUPO_B.id)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'b.3 tras elegir Grupo B')

    await abrirSheetYElegir(page, 'todos')
    await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
    const finB = await paso(page, 'b.4 Todos estabilizado tras A y B')
    console.log(`[VEREDICTO] b: ${todosCorrecto(finB) ? 'OK' : 'FALLA'}`)
  }

  // (d) tocar el chip mientras carga (sin esperar a que estabilice)
  if (caso === 'd' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await page.waitForTimeout(150)
    await paso(page, 'd.1 Todos recién navegado (aún cargando)')

    await abrirSheetYElegir(page, GRUPO_A.id)
    await page.waitForTimeout(100) // no espera a que A cargue
    await paso(page, 'd.2 elegido A sin esperar carga')

    await abrirSheetYElegir(page, 'todos')
    await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
    const finD = await paso(page, 'd.3 Todos estabilizado tras tocar el chip en caliente')
    console.log(`[VEREDICTO] d: ${todosCorrecto(finD) ? 'OK' : 'FALLA'}`)
  }

  // (e) alcance Personal: Todo -> Personal -> Todo
  if (caso === 'e' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'e.1 Todos/Todo inicial')

    const esSoloPersonal = (s) => s.visibles.includes(GASTO_PERSONAL) && !s.visibles.includes(GASTO_A) && !s.visibles.includes(GASTO_B)
    await page.getByText('Personal', { exact: true }).first().click()
    const { ok: personalOk, estado: soloPersonal } = await esperarCondicion(page, esSoloPersonal, { timeout: 2 * maxDelay + 3000 })
    registrar('paso', { nombre: 'e.2 tras cambiar a alcance Personal', ...soloPersonal })

    await page.getByText('Todo', { exact: true }).first().click()
    const { ok: todoOk, estado: finE } = await esperarCondicion(page, todosCorrecto, { timeout: 3 * maxDelay + 4000 })
    registrar('paso', { nombre: 'e.3 de vuelta a alcance Todo', ...finE })
    console.log(`[VEREDICTO] e: personal=${personalOk ? 'OK' : 'FALLA'} todo=${todoOk ? 'OK' : 'FALLA'}`)
  }

  // (f) entrar al detalle de un gasto y volver con back-navigation
  if (caso === 'f' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'f.1 Todos inicial')

    await page.getByText(GASTO_A, { exact: false }).first().click()
    await page.waitForTimeout(500)
    await paso(page, 'f.2 en detalle del gasto')

    await page.goBack()
    const { ok: fOk, estado: finF } = await esperarCondicion(page, todosCorrecto, { timeout: 3 * maxDelay + 4000 })
    registrar('paso', { nombre: 'f.3 de vuelta en Historial (back-navigation)', ...finF })
    console.log(`[VEREDICTO] f: ${fOk ? 'OK' : 'FALLA'}`)
  }

  // (g) tras recargar la página estando en Todos
  if (caso === 'g' || caso === 'all') {
    await page.goto(`${BASE}/historial?grupo=todos`)
    await esperarEstable(page, { timeout: 2 * maxDelay + 3000 })
    await paso(page, 'g.1 Todos antes de recargar')

    await page.reload()
    await esperarEstable(page, { timeout: 3 * maxDelay + 4000 })
    const finG = await paso(page, 'g.2 Todos tras recargar')
    console.log(`[VEREDICTO] g: ${todosCorrecto(finG) ? 'OK' : 'FALLA'}`)
  }

  await page.waitForTimeout(200)
  await browser.close()

  console.log('\n=== Resumen de requests REST (orden de llegada) ===')
  log.filter(l => l.evento === 'rest-response').forEach(l => console.log(`  #${l.idx} ${l.tabla} respondió en t=${l.t}`))

  console.log('\n=== Log completo (JSON) ===')
  console.log(JSON.stringify(log, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
