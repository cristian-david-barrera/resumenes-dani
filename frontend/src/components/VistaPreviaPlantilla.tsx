import { useEffect, useState } from 'react'
import { generarPreviewPlantilla } from '../lib/previewPlantilla'
import { obtenerPlantilla } from '../lib/plantillasStore'

type Props = {
  plantillaId: string
  nombre: string
}

export function VistaPreviaPlantilla({ plantillaId, nombre }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false

    void (async () => {
      try {
        const plantilla = await obtenerPlantilla(plantillaId)
        if (!plantilla || cancelado) return
        const preview = await generarPreviewPlantilla(plantilla)
        if (!cancelado) setSrc(preview)
      } catch {
        if (!cancelado) setError(true)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [plantillaId])

  if (error) {
    return <div className="preview-plantilla fallback">Sin vista previa</div>
  }

  if (!src) {
    return <div className="preview-plantilla fallback">Cargando...</div>
  }

  return (
    <div className="preview-plantilla">
      <img src={src} alt={`Vista previa de ${nombre}`} />
    </div>
  )
}
