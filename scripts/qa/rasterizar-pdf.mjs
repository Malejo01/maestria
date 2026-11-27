// Tanda AC · AC4 — Un "escaneo" de prueba a partir de un PDF de texto: cada
// página pasa a una imagen JPEG en grises y se arma un PDF nuevo SIN capa de
// texto (como el que sale de un escáner). Sirve para medir la extracción de
// escaneos con programas cuyo PDF de texto ya conocemos.
//
//   node scripts/qa/rasterizar-pdf.mjs <entrada.pdf> <salida.pdf> [escala=1.6]
//
// Sin dependencias nuevas: pdf-parse (pdf.js) para dibujar las páginas, sharp
// para el JPEG, y el PDF se escribe a mano (una imagen DCTDecode por página).
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFParse } from 'pdf-parse'
import sharp from 'sharp'

const [entrada, salida, escalaCruda] = process.argv.slice(2)
if (!entrada || !salida) {
  console.error('Uso: node scripts/qa/rasterizar-pdf.mjs <entrada.pdf> <salida.pdf> [escala]')
  process.exit(1)
}
const escala = Number(escalaCruda ?? 1.6)

const parser = new PDFParse({ data: readFileSync(entrada) })
const { pages } = await parser.getScreenshot({ scale: escala })
await parser.destroy()

const imagenes = []
for (const pagina of pages) {
  const jpeg = await sharp(Buffer.from(pagina.data)).grayscale().jpeg({ quality: 72 }).toBuffer()
  const meta = await sharp(jpeg).metadata()
  imagenes.push({ jpeg, ancho: meta.width, alto: meta.height })
}

// El PDF: 1 catálogo, 2 páginas; por página: la página, su contenido y su imagen.
const objetos = []
const agregar = (cuerpo) => objetos.push(cuerpo) // número = índice + 1
agregar('<< /Type /Catalog /Pages 2 0 R >>')
agregar(null) // las páginas, al final
const kids = []
for (const img of imagenes) {
  // Tamaño en puntos: A4 de ancho, alto proporcional.
  const anchoPt = 595
  const altoPt = Math.round((img.alto / img.ancho) * anchoPt)
  const nPagina = objetos.length + 1
  const nContenido = nPagina + 1
  const nImagen = nPagina + 2
  kids.push(`${nPagina} 0 R`)
  agregar(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPt} ${altoPt}] /Resources << /XObject << /Im0 ${nImagen} 0 R >> >> /Contents ${nContenido} 0 R >>`)
  const contenido = `q ${anchoPt} 0 0 ${altoPt} 0 0 cm /Im0 Do Q`
  agregar({ dict: `<< /Length ${contenido.length} >>`, datos: Buffer.from(contenido, 'latin1') })
  agregar({
    dict: `<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`,
    datos: img.jpeg,
  })
}
objetos[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`

const partes = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
const offsets = []
let largo = partes[0].length
objetos.forEach((obj, i) => {
  offsets.push(largo)
  const cabeza = Buffer.from(`${i + 1} 0 obj\n`, 'latin1')
  const cuerpo =
    typeof obj === 'string'
      ? Buffer.from(`${obj}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${obj.dict}\nstream\n`, 'latin1'), obj.datos, Buffer.from('\nendstream\nendobj\n', 'latin1')])
  partes.push(cabeza, cuerpo)
  largo += cabeza.length + cuerpo.length
})
const xref = [`xref\n0 ${objetos.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('')
partes.push(Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`, 'latin1'))
writeFileSync(salida, Buffer.concat(partes))
console.log(`${salida}: ${imagenes.length} páginas, ${Math.round(Buffer.concat(partes).length / 1024)} KB, sin texto`)
