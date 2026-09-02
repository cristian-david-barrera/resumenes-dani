import { aMeta, type Plantilla, type PlantillaMeta } from '../types/plantilla'

const DB_NAME = 'daniela-plantillas'
const STORE = 'plantillas'
const DB_VERSION = 1
const SELECTED_KEY = 'daniela.plantillaSeleccionada'

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
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

export async function listarPlantillas(): Promise<PlantillaMeta[]> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const all = await requestToPromise(store.getAll() as IDBRequest<Plantilla[]>)
  return all
    .map(aMeta)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function obtenerPlantilla(id: string): Promise<Plantilla | null> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const plantilla = await requestToPromise(
    store.get(id) as IDBRequest<Plantilla | undefined>,
  )
  return plantilla ?? null
}

export async function guardarPlantilla(archivo: File): Promise<PlantillaMeta> {
  const bytes = await archivo.arrayBuffer()
  const plantilla: Plantilla = {
    id: crypto.randomUUID(),
    nombre: archivo.name,
    mimeType: archivo.type || 'application/octet-stream',
    bytes,
    createdAt: Date.now(),
  }

  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).put(plantilla))

  return aMeta(plantilla)
}

export async function eliminarPlantilla(id: string): Promise<void> {
  const db = await abrirDb()
  const tx = db.transaction(STORE, 'readwrite')
  await requestToPromise(tx.objectStore(STORE).delete(id))

  if (obtenerPlantillaSeleccionadaId() === id) {
    localStorage.removeItem(SELECTED_KEY)
  }
}

export function obtenerPlantillaSeleccionadaId(): string | null {
  return localStorage.getItem(SELECTED_KEY)
}

export function guardarPlantillaSeleccionadaId(id: string | null): void {
  if (!id) {
    localStorage.removeItem(SELECTED_KEY)
    return
  }
  localStorage.setItem(SELECTED_KEY, id)
}
