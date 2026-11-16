/**
 * Deriva los íconos de `public/` desde `public/icon.svg`, que es la única
 * fuente. No toca la base ni la red.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Genera icon-32x32.png, apple-icon.png (180) y favicon.ico (16 + 32, con los
 * PNG embebidos: un .ico de verdad, no un PNG renombrado). Si cambia el arte,
 * se cambia el SVG y se vuelve a correr.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const svg = await readFile(join(publicDir, 'icon.svg'))

const png = (lado) => sharp(svg, { density: 384 }).resize(lado, lado).png().toBuffer()

/** Contenedor ICO con entradas PNG (válido desde Windows Vista y en todos los navegadores). */
function ico(imagenes) {
  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0) // reservado
  cabecera.writeUInt16LE(1, 2) // tipo: ícono
  cabecera.writeUInt16LE(imagenes.length, 4)

  let desplazamiento = 6 + 16 * imagenes.length
  const directorio = imagenes.map(({ lado, datos }) => {
    const entrada = Buffer.alloc(16)
    entrada.writeUInt8(lado, 0)
    entrada.writeUInt8(lado, 1)
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por píxel
    entrada.writeUInt32LE(datos.length, 8)
    entrada.writeUInt32LE(desplazamiento, 12)
    desplazamiento += datos.length
    return entrada
  })

  return Buffer.concat([cabecera, ...directorio, ...imagenes.map((imagen) => imagen.datos)])
}

const [p16, p32, p180] = await Promise.all([png(16), png(32), png(180)])

await writeFile(join(publicDir, 'icon-32x32.png'), p32)
await writeFile(join(publicDir, 'apple-icon.png'), p180)
await writeFile(
  join(publicDir, 'favicon.ico'),
  ico([
    { lado: 16, datos: p16 },
    { lado: 32, datos: p32 },
  ]),
)

console.log('Listo: icon-32x32.png, apple-icon.png, favicon.ico')
