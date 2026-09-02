import type { DatosFormularioGuardado } from '../lib/formularioSnapshot'

export type PdfCarpeta = {
  id: string
  /** Ej. nombre de la persona. */
  nombre: string
  createdAt: number
  updatedAt: number
}

export type PdfHistorialItem = {
  id: string
  /** Carpeta contenedora; null = sin carpeta. */
  carpetaId: string | null
  /** Nombre identificatorio editable por el usuario. */
  nombre: string
  /** Nombre de archivo usado al descargar (ej. resumen.pdf). */
  nombreArchivo: string
  bytes: ArrayBuffer
  /** Datos del formulario para poder reeditar (PDFs nuevos). */
  datosFormulario?: DatosFormularioGuardado | null
  createdAt: number
  updatedAt: number
}

export type PdfHistorialMeta = {
  id: string
  carpetaId: string | null
  nombre: string
  nombreArchivo: string
  createdAt: number
  updatedAt: number
  tamanioBytes: number
  editable: boolean
}

export function aMetaHistorial(item: PdfHistorialItem): PdfHistorialMeta {
  return {
    id: item.id,
    carpetaId: item.carpetaId ?? null,
    nombre: item.nombre,
    nombreArchivo: item.nombreArchivo,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tamanioBytes: item.bytes.byteLength,
    editable: Boolean(item.datosFormulario),
  }
}

export function nombreArchivoDesdeIdentificador(nombre: string): string {
  const limpio = nombre
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  const base = limpio || 'resumen'
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}
