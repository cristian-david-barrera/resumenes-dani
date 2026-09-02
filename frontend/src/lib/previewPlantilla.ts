import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Plantilla } from '../types/plantilla'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const cache = new Map<string, string>()

async function pdfADataUrl(bytes: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.45 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo crear el canvas de vista previa')
  }

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  return canvas.toDataURL('image/png')
}

export async function generarPreviewPlantilla(
  plantilla: Plantilla,
): Promise<string> {
  const cached = cache.get(plantilla.id)
  if (cached) return cached

  let preview: string

  if (plantilla.mimeType.startsWith('image/')) {
    const blob = new Blob([plantilla.bytes], { type: plantilla.mimeType })
    preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } else if (plantilla.mimeType === 'application/pdf') {
    preview = await pdfADataUrl(plantilla.bytes)
  } else {
    throw new Error('Tipo de plantilla no soportado para vista previa')
  }

  cache.set(plantilla.id, preview)
  return preview
}

export function invalidarPreviewPlantilla(id: string): void {
  cache.delete(id)
}
