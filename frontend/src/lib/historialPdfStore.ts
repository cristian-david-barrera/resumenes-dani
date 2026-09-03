import type { DatosFormularioGuardado } from './formularioSnapshot'
import {
  nombreArchivoDesdeIdentificador,
  type PdfCarpeta,
  type PdfHistorialItem,
  type PdfHistorialMeta,
} from '../types/historialPdf'

const DB_NAME = 'daniela-historial-pdf'
const STORE = 'historial'
const STORE_CARPETAS = 'carpetas'
const DB_VERSION = 2
const MIGRACION_FLAG = 'daniela-historial-migrado-a-disco'

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binario)
}

function base64AArrayBuffer(base64: string): ArrayBuffer {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i)
  }
  return bytes.buffer
}

function abrirDbLocal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CARPETAS)) {
        db.createObjectStore(STORE_CARPETAS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function leerTodoIndexedDb(): Promise<{
  carpetas: PdfCarpeta[]
  pdfs: PdfHistorialItem[]
}> {
  try {
    const db = await abrirDbLocal()
    const tx = db.transaction([STORE, STORE_CARPETAS], 'readonly')
    const carpetas = await requestToPromise(
      tx.objectStore(STORE_CARPETAS).getAll() as IDBRequest<PdfCarpeta[]>,
    )
    const pdfs = await requestToPromise(
      tx.objectStore(STORE).getAll() as IDBRequest<PdfHistorialItem[]>,
    )
    return { carpetas, pdfs }
  } catch {
    return { carpetas: [], pdfs: [] }
  }
}

let migracionEnCurso: Promise<void> | null = null

/** Migra una vez el historial viejo del navegador a Documentos/resumenes. */
async function migrarIndexedDbSiHaceFalta(): Promise<void> {
  if (localStorage.getItem(MIGRACION_FLAG) === '1') return
  if (migracionEnCurso) return migracionEnCurso

  migracionEnCurso = (async () => {
    const local = await leerTodoIndexedDb()
    if (local.carpetas.length === 0 && local.pdfs.length === 0) {
      localStorage.setItem(MIGRACION_FLAG, '1')
      return
    }

    await api<{ importados: number; ruta: string }>('/api/resumenes/importar', {
      method: 'POST',
      body: JSON.stringify({
        carpetas: local.carpetas,
        pdfs: local.pdfs.map((pdf) => ({
          id: pdf.id,
          carpetaId: pdf.carpetaId ?? null,
          nombre: pdf.nombre,
          nombreArchivo: pdf.nombreArchivo,
          createdAt: pdf.createdAt,
          updatedAt: pdf.updatedAt,
          bytesBase64: arrayBufferABase64(pdf.bytes),
          datosFormulario: pdf.datosFormulario ?? null,
        })),
      }),
    })
    localStorage.setItem(MIGRACION_FLAG, '1')
  })().finally(() => {
    migracionEnCurso = null
  })

  return migracionEnCurso
}

export async function obtenerRutaResumenes(): Promise<string> {
  const data = await api<{ ruta: string }>('/api/resumenes/ruta')
  return data.ruta
}

export async function listarCarpetas(): Promise<PdfCarpeta[]> {
  await migrarIndexedDbSiHaceFalta()
  const data = await api<{ carpetas: PdfCarpeta[] }>('/api/resumenes/carpetas')
  return data.carpetas
}

export async function crearCarpeta(nombre: string): Promise<PdfCarpeta> {
  await migrarIndexedDbSiHaceFalta()
  return api<PdfCarpeta>('/api/resumenes/carpetas', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  })
}

export async function renombrarCarpeta(
  id: string,
  nombre: string,
): Promise<PdfCarpeta | null> {
  return api<PdfCarpeta>(`/api/resumenes/carpetas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ nombre }),
  })
}

export async function eliminarCarpeta(id: string): Promise<void> {
  await api<void>(`/api/resumenes/carpetas/${id}`, { method: 'DELETE' })
}

export async function listarHistorialPdf(
  carpetaId?: string | null,
): Promise<PdfHistorialMeta[]> {
  await migrarIndexedDbSiHaceFalta()
  const query =
    carpetaId === undefined
      ? ''
      : `?carpetaId=${carpetaId === null ? 'null' : encodeURIComponent(carpetaId)}`
  const data = await api<{ pdfs: PdfHistorialMeta[] }>(
    `/api/resumenes/pdfs${query}`,
  )
  return data.pdfs
}

export async function contarPdfsPorCarpeta(): Promise<Record<string, number>> {
  await migrarIndexedDbSiHaceFalta()
  const data = await api<{ conteos: Record<string, number> }>(
    '/api/resumenes/conteos',
  )
  return data.conteos
}

export async function obtenerHistorialPdf(
  id: string,
): Promise<PdfHistorialItem | null> {
  try {
    const data = await api<{
      id: string
      carpetaId: string | null
      nombre: string
      nombreArchivo: string
      createdAt: number
      updatedAt: number
      bytesBase64: string
      datosFormulario?: DatosFormularioGuardado | null
    }>(`/api/resumenes/pdfs/${id}`)
    return {
      id: data.id,
      carpetaId: data.carpetaId,
      nombre: data.nombre,
      nombreArchivo: data.nombreArchivo,
      bytes: base64AArrayBuffer(data.bytesBase64),
      datosFormulario: data.datosFormulario ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  } catch {
    return null
  }
}

export async function guardarEnHistorialPdf(opciones: {
  nombre: string
  bytes: ArrayBuffer
  carpetaId?: string | null
  nombreArchivoSugerido?: string
  datosFormulario?: DatosFormularioGuardado | null
  idExistente?: string | null
}): Promise<PdfHistorialMeta> {
  await migrarIndexedDbSiHaceFalta()
  const nombre = opciones.nombre.trim() || 'Sin nombre'
  const nombreArchivo =
    opciones.nombreArchivoSugerido?.trim() ||
    nombreArchivoDesdeIdentificador(nombre)

  return api<PdfHistorialMeta>('/api/resumenes/pdfs', {
    method: 'POST',
    body: JSON.stringify({
      nombre,
      nombreArchivoSugerido: nombreArchivo,
      carpetaId: opciones.carpetaId ?? null,
      bytesBase64: arrayBufferABase64(opciones.bytes),
      datosFormulario: opciones.datosFormulario ?? null,
      idExistente: opciones.idExistente ?? null,
    }),
  })
}

export async function renombrarHistorialPdf(
  id: string,
  nombre: string,
): Promise<PdfHistorialMeta | null> {
  return api<PdfHistorialMeta>(`/api/resumenes/pdfs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ nombre }),
  })
}

export async function moverHistorialPdf(
  id: string,
  carpetaId: string | null,
): Promise<PdfHistorialMeta | null> {
  return api<PdfHistorialMeta>(`/api/resumenes/pdfs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ carpetaId }),
  })
}

export async function eliminarHistorialPdf(id: string): Promise<void> {
  await api<void>(`/api/resumenes/pdfs/${id}`, { method: 'DELETE' })
}
