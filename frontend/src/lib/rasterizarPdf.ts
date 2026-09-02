import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * Convierte cada página de un PDF en PNG (Uint8Array).
 * Usa pdf.js, que tolera más variantes de compresión que pdf-lib.
 */
export async function rasterizarPdfAPngs(
  bytes: ArrayBuffer | Uint8Array,
  scale = 1.75,
): Promise<Uint8Array[]> {
  // Copia: pdf.js puede transferir/detach el buffer.
  const data = Uint8Array.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  )
  const pdf = await pdfjs.getDocument({ data }).promise
  const paginas: Uint8Array[] = []

  for (let numero = 1; numero <= pdf.numPages; numero += 1) {
    const page = await pdf.getPage(numero)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('No se pudo preparar el canvas para el PDF adjunto')
    }

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((resultado) => resolve(resultado), 'image/png')
    })
    if (!blob) {
      throw new Error('No se pudo convertir una página del PDF a imagen')
    }

    paginas.push(new Uint8Array(await blob.arrayBuffer()))
  }

  return paginas
}
