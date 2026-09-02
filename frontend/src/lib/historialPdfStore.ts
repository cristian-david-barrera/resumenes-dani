import type { DatosFormularioGuardado } from './formularioSnapshot'
import {
  aMetaHistorial,
  nombreArchivoDesdeIdentificador,
  type PdfCarpeta,
  type PdfHistorialItem,
  type PdfHistorialMeta,
} from '../types/historialPdf'

const DB_NAME = 'daniela-historial-pdf'
const STORE = 'historial'
const STORE_CARPETAS = 'carpetas'
const DB_VERSION = 2

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (evento) => {
      const db = request.result
      const tx = request.transaction
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CARPETAS)) {
        db.createObjectStore(STORE_CARPETAS, { keyPath: 'id' })
      }

      if (evento.oldVersion < 2 && tx) {
        const store = tx.objectStore(STORE)
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return
          const valor = cursor.value as PdfHistorialItem & {
            carpetaId?: string | null
          }
          if (valor.carpetaId === undefined) {
            cursor.update({ ...valor, carpetaId: null })
          }
          cursor.continue()
        }
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

export async function listarCarpetas(): Promise<PdfCarpeta[]> {
  const db = await abrirDb()
  const tx = db.transaction(STORE_CARPETAS, 'readonly')
  const all = await requestToPromise(
    tx.objectStore(STORE_CARPETAS).getAll() as IDBRequest<PdfCarpeta[]>,
  )
  return all.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
}

export async function crearCarpeta(nombre: string): Promise<PdfCarpeta> {
  const ahora = Date.now()
  const carpeta: PdfCarpeta = {
    id: crypto.randomUUID(),
    nombre: nombre.trim() || 'Sin nombre',
    createdAt: ahora,
    updatedAt: ahora,
  }
  const db = await abrirDb()
  const tx = db.transaction(STORE_CARPETAS, 'readwrite')
  await requestToPromise(tx.objectStore(STORE_CARPETAS).put(carpeta))
  return carpeta
}

export async function renombrarCarpeta(
  id: string,
  nombre: string,
): Promise<PdfCarpeta | null> {
  const db = await abrirDb()
  const tx = db.transaction(STORE_CARPETAS, 'readwrite')
  const store = tx.objectStore(STORE_CARPETAS)
  const actual = await requestToPromise(
    store.get(id) as IDBRequest<PdfCarpeta | undefined>,
  )
  if (!actual) return null

  const actualizada: PdfCarpeta = {
    ...actual,
    nombre: nombre.trim() || 'Sin nombre',
    updatedAt: Date.now(),
  }
  await requestToPromise(store.put(actualizada))
  return actualizada
}

export async function eliminarCarpeta(id: string): Promise<void> {
  const db = await abrirDb()
  const tx = db.transaction([STORE_CARPETAS, STORE], 'readwrite')
  const pdfs = await requestToPromise(
    tx.objectStore(STORE).getAll() as IDBRequest<PdfHistorialItem[]>,
  )
  for (const pdf of pdfs) {
    if (pdf.carpetaId === id) {
      await requestToPromise(tx.objectStore(STORE).delete(pdf.id))
    }
  }
  await requestToPromise(tx.objectStore(STORE_CARPETAS).delete(id))
}

export async function listarHistorialPdf(
  carpetaId?: string | null,
): Promise<PdfHistorialMeta[]> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readonly')
  const all = await requestToPromise(
    tx.objectStore(STORE).getAll() as IDBRequest<PdfHistorialItem[]>,
  )
  return all
    .map(aMetaHistorial)
    .filter((item) =>
      carpetaId === undefined ? true : item.carpetaId === carpetaId,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function contarPdfsPorCarpeta(): Promise<Record<string, number>> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readonly')
  const all = await requestToPromise(
    tx.objectStore(STORE).getAll() as IDBRequest<PdfHistorialItem[]>,
  )
  const conteo: Record<string, number> = {}
  for (const item of all) {
    const clave = item.carpetaId ?? '__sin_carpeta__'
    conteo[clave] = (conteo[clave] ?? 0) + 1
  }
  return conteo
}

export async function obtenerHistorialPdf(
  id: string,
): Promise<PdfHistorialItem | null> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readonly')
  const item = await requestToPromise(
    tx.objectStore(STORE).get(id) as IDBRequest<PdfHistorialItem | undefined>,
  )
  return item ?? null
}

export async function guardarEnHistorialPdf(opciones: {
  nombre: string
  bytes: ArrayBuffer
  carpetaId?: string | null
  nombreArchivoSugerido?: string
  datosFormulario?: DatosFormularioGuardado | null
  /** Si se indica, actualiza ese PDF en lugar de crear uno nuevo. */
  idExistente?: string | null
}): Promise<PdfHistorialMeta> {
  const ahora = Date.now()
  const nombre = opciones.nombre.trim() || 'Sin nombre'
  const nombreArchivo =
    opciones.nombreArchivoSugerido?.trim() ||
    nombreArchivoDesdeIdentificador(nombre)

  let item: PdfHistorialItem

  if (opciones.idExistente) {
    const actual = await obtenerHistorialPdf(opciones.idExistente)
    if (actual) {
      item = {
        ...actual,
        carpetaId: opciones.carpetaId ?? actual.carpetaId,
        nombre,
        nombreArchivo,
        bytes: opciones.bytes,
        datosFormulario: opciones.datosFormulario ?? actual.datosFormulario,
        updatedAt: ahora,
      }
    } else {
      item = {
        id: crypto.randomUUID(),
        carpetaId: opciones.carpetaId ?? null,
        nombre,
        nombreArchivo,
        bytes: opciones.bytes,
        datosFormulario: opciones.datosFormulario ?? null,
        createdAt: ahora,
        updatedAt: ahora,
      }
    }
  } else {
    item = {
      id: crypto.randomUUID(),
      carpetaId: opciones.carpetaId ?? null,
      nombre,
      nombreArchivo,
      bytes: opciones.bytes,
      datosFormulario: opciones.datosFormulario ?? null,
      createdAt: ahora,
      updatedAt: ahora,
    }
  }

  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).put(item))
  return aMetaHistorial(item)
}

export async function renombrarHistorialPdf(
  id: string,
  nombre: string,
): Promise<PdfHistorialMeta | null> {
  const actual = await obtenerHistorialPdf(id)
  if (!actual) return null

  const nuevoNombre = nombre.trim() || 'Sin nombre'
  const actualizado: PdfHistorialItem = {
    ...actual,
    nombre: nuevoNombre,
    nombreArchivo: nombreArchivoDesdeIdentificador(nuevoNombre),
    updatedAt: Date.now(),
  }

  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).put(actualizado))
  return aMetaHistorial(actualizado)
}

export async function moverHistorialPdf(
  id: string,
  carpetaId: string | null,
): Promise<PdfHistorialMeta | null> {
  const actual = await obtenerHistorialPdf(id)
  if (!actual) return null

  const actualizado: PdfHistorialItem = {
    ...actual,
    carpetaId,
    updatedAt: Date.now(),
  }

  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).put(actualizado))
  return aMetaHistorial(actualizado)
}

export async function eliminarHistorialPdf(id: string): Promise<void> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).delete(id))
}
