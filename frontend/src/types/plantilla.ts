export type Plantilla = {
  id: string
  nombre: string
  mimeType: string
  bytes: ArrayBuffer
  createdAt: number
}

export type PlantillaMeta = {
  id: string
  nombre: string
  mimeType: string
  createdAt: number
  esImagen: boolean
  esPdf: boolean
}

export function aMeta(plantilla: Plantilla): PlantillaMeta {
  return {
    id: plantilla.id,
    nombre: plantilla.nombre,
    mimeType: plantilla.mimeType,
    createdAt: plantilla.createdAt,
    esImagen: plantilla.mimeType.startsWith('image/'),
    esPdf: plantilla.mimeType === 'application/pdf',
  }
}
