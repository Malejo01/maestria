/**
 * Capturas de pantalla para los reportes del rediseño: cada ruta a 1440 y a
 * 390 px, en modo claro y oscuro.
 *
 *   node scripts/capturas.mjs <carpeta-de-salida> <ruta> [<ruta>…]
 *   node scripts/capturas.mjs docs/capturas/bloque-1 / /sign-in?rol=docente
 *
 * En Git Bash anteponé MSYS_NO_PATHCONV=1: si no, convierte "/" en la carpeta
 * de instalación de Git y el navegador recibe una URL inválida.
 *
 * Variables opcionales:
 *   BASE=http://localhost:3000   de dónde se sirven las rutas
 *   MODOS=claro,oscuro           qué modos capturar
 *   ANCHOS=1440,390              qué anchos capturar
 *   COOKIE="nombre=valor"        cookie de sesión, para pantallas con login
 *   ENTRAR_COMO="Nombre"         entra por el ingreso de desarrollo (/sign-in/dev,
 *                                sólo con `npm run dev:staging`) como el usuario
 *                                cuyo nombre contenga ese texto
 *
 * No usa Playwright ni Puppeteer: levanta el navegador instalado (Edge o
 * Chrome) sin ventana y lo maneja por el protocolo de DevTools con el
 * WebSocket que trae Node. No toca la base: sólo navega y saca fotos.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , salida, ...rutas] = process.argv
if (!salida || rutas.length === 0) {
  console.error('Uso: node scripts/capturas.mjs <carpeta-de-salida> <ruta> [<ruta>…]')
  process.exit(1)
}

const BASE = process.env.BASE ?? 'http://localhost:3000'
const MODOS = (process.env.MODOS ?? 'claro,oscuro').split(',')
const ANCHOS = (process.env.ANCHOS ?? '1440,390').split(',').map(Number)
const ALTO = { 1440: 900, 390: 844 }
const PUERTO = 9333

const NAVEGADORES = [
  process.env.NAVEGADOR,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const ejecutable = NAVEGADORES.find((ruta) => existsSync(ruta))
if (!ejecutable) {
  console.error('No encontré Chrome ni Edge. Pasá la ruta en NAVEGADOR=…')
  process.exit(1)
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const nombreDe = (ruta) => (ruta === '/' ? 'raiz' : ruta.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-'))

const perfil = await mkdtemp(join(tmpdir(), 'capturas-'))
const navegador = spawn(
  ejecutable,
  [
    '--headless=new',
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${perfil}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

try {
  // El puerto de DevTools tarda un instante en abrir.
  let destino
  for (let intento = 0; intento < 50 && !destino; intento++) {
    await esperar(200)
    try {
      const paginas = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()
      destino = paginas.find((pagina) => pagina.type === 'page')
    } catch {
      // Todavía no levantó.
    }
  }
  if (!destino) throw new Error('El navegador no abrió el puerto de DevTools.')

  const ws = new WebSocket(destino.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  let id = 0
  const pendientes = new Map()
  const alCargar = new Set()
  ws.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data)
    if (mensaje.id && pendientes.has(mensaje.id)) {
      const { resolve, reject } = pendientes.get(mensaje.id)
      pendientes.delete(mensaje.id)
      if (mensaje.error) reject(new Error(mensaje.error.message))
      else resolve(mensaje.result)
    } else if (mensaje.method === 'Page.loadEventFired') {
      for (const avisar of alCargar) avisar()
      alCargar.clear()
    }
  })
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pendientes.set(++id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const navegar = async (url) => {
    const cargada = new Promise((resolve) => alCargar.add(resolve))
    await cdp('Page.navigate', { url })
    await Promise.race([cargada, esperar(30_000)])
  }

  await cdp('Page.enable')
  await cdp('Network.enable')
  if (process.env.COOKIE) {
    const [name, ...resto] = process.env.COOKIE.split('=')
    await cdp('Network.setCookie', { name, value: resto.join('='), url: BASE })
  }

  if (process.env.ENTRAR_COMO) {
    await navegar(`${BASE}/sign-in/dev`)
    await esperar(1500)
    const { result } = await cdp('Runtime.evaluate', {
      expression: `(() => {
        const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(process.env.ENTRAR_COMO)}))
        if (!boton) return false
        boton.click()
        return true
      })()`,
      returnByValue: true,
    })
    if (!result.value) throw new Error(`No encontré a "${process.env.ENTRAR_COMO}" en /sign-in/dev.`)
    // El ingreso redirige a la raíz y de ahí al inicio del rol.
    await esperar(6000)
  }

  await mkdir(salida, { recursive: true })

  for (const modo of MODOS) {
    // El modo se guarda en localStorage (lib/tema.ts): se escribe una vez por
    // modo, estando ya en el origen, y vale para todas las rutas siguientes.
    await navegar(BASE)
    await cdp('Runtime.evaluate', { expression: `localStorage.setItem('maestria-tema', '${modo}')` })

    for (const ancho of ANCHOS) {
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: ancho,
        height: ALTO[ancho] ?? 900,
        deviceScaleFactor: 1,
        mobile: ancho < 768,
      })

      for (const ruta of rutas) {
        await navegar(BASE + ruta)
        // Datos que llegan por fetch y animaciones de entrada.
        await esperar(1500)
        const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
        const archivo = join(salida, `${nombreDe(ruta)}-${ancho}-${modo}.png`)
        await writeFile(archivo, Buffer.from(data, 'base64'))
        console.log(archivo)
      }
    }
  }

  ws.close()
} finally {
  navegador.kill()
  await esperar(300)
  await rm(perfil, { recursive: true, force: true }).catch(() => {})
}
