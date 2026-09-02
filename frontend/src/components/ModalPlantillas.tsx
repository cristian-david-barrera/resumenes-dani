import { useEffect, useId, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  eliminarPlantilla,
  guardarPlantilla,
  guardarPlantillaSeleccionadaId,
  listarPlantillas,
} from '../lib/plantillasStore'
import { invalidarPreviewPlantilla } from '../lib/previewPlantilla'
import type { PlantillaMeta } from '../types/plantilla'
import { VistaPreviaPlantilla } from './VistaPreviaPlantilla'

type Props = {
  abierto: boolean
  seleccionadaId: string | null
  onCerrar: () => void
  onSeleccionChange: (id: string | null) => void
}

function esPlantillaValida(archivo: File): boolean {
  return (
    archivo.type.startsWith('image/') ||
    archivo.type === 'application/pdf' ||
    archivo.name.toLowerCase().endsWith('.pdf')
  )
}

export function ModalPlantillas({
  abierto,
  seleccionadaId,
  onCerrar,
  onSeleccionChange,
}: Props) {
  const inputId = useId()
  const [plantillas, setPlantillas] = useState<PlantillaMeta[]>([])
  const [cargando, setCargando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refrescar() {
    const lista = await listarPlantillas()
    setPlantillas(lista)
  }

  useEffect(() => {
    if (!abierto) return
    setMensaje(null)
    setError(null)
    void refrescar()
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abierto, onCerrar])

  if (!abierto) return null

  async function subirArchivo(archivo: File | null | undefined) {
    if (!archivo) return
    if (!esPlantillaValida(archivo)) {
      setError('Solo se permiten imágenes o PDF como plantilla')
      return
    }

    setCargando(true)
    setError(null)
    try {
      const nueva = await guardarPlantilla(archivo)
      await refrescar()
      guardarPlantillaSeleccionadaId(nueva.id)
      onSeleccionChange(nueva.id)
      setMensaje(`Plantilla "${nueva.nombre}" cargada y seleccionada`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la plantilla',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onFileChange(evento: ChangeEvent<HTMLInputElement>) {
    await subirArchivo(evento.target.files?.[0])
    evento.target.value = ''
  }

  async function onDrop(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault()
    setArrastrando(false)
    await subirArchivo(evento.dataTransfer.files?.[0])
  }

  async function onEliminar(id: string) {
    setCargando(true)
    setError(null)
    try {
      await eliminarPlantilla(id)
      invalidarPreviewPlantilla(id)
      await refrescar()
      if (seleccionadaId === id) {
        onSeleccionChange(null)
      }
      setMensaje('Plantilla eliminada')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar la plantilla',
      )
    } finally {
      setCargando(false)
    }
  }

  function seleccionar(id: string) {
    guardarPlantillaSeleccionadaId(id)
    onSeleccionChange(id)
    setMensaje('Plantilla seleccionada para generar el PDF')
  }

  return (
    <div className="modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="modal-adjunto modal-plantillas"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-plantillas-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-adjunto-cabecera">
          <h2 id="modal-plantillas-titulo">Plantillas</h2>
          <button type="button" className="btn-cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        <p className="plantillas-intro">
          El PDF se genera sobre la plantilla seleccionada.
        </p>

        <div
          className={`zona-carga${arrastrando ? ' arrastrando' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setArrastrando(false)
          }}
          onDrop={onDrop}
        >
          <p className="zona-carga-titulo">
            Arrastrá una plantilla acá o elegila desde tu equipo
          </p>
          <p className="zona-carga-ayuda">PDF o imagen</p>
          <label htmlFor={inputId} className="btn ghost btn-elegir">
            Cargar plantilla nueva
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={onFileChange}
            hidden
            disabled={cargando}
          />
        </div>

        {mensaje ? <p className="modal-mensaje">{mensaje}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <div className="lista-plantillas">
          {plantillas.length === 0 ? (
            <p className="adjunto-vacio">No hay plantillas cargadas todavía</p>
          ) : (
            plantillas.map((plantilla) => {
              const activa = plantilla.id === seleccionadaId
              return (
                <article
                  key={plantilla.id}
                  className={`item-plantilla${activa ? ' activa' : ''}`}
                >
                  <VistaPreviaPlantilla
                    plantillaId={plantilla.id}
                    nombre={plantilla.nombre}
                  />
                  <div className="item-plantilla-cuerpo">
                    <div className="item-plantilla-info">
                      <strong>{plantilla.nombre}</strong>
                      <span>
                        {plantilla.esPdf ? 'PDF' : 'Imagen'}
                        {activa ? ' · Seleccionada' : ''}
                      </span>
                    </div>
                    <div className="item-plantilla-acciones">
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={activa || cargando}
                        onClick={() => seleccionar(plantilla.id)}
                      >
                        Usar
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={cargando}
                        onClick={() => void onEliminar(plantilla.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="modal-acciones">
          <button
            type="button"
            className="btn ghost"
            disabled={!seleccionadaId || cargando}
            onClick={() => {
              guardarPlantillaSeleccionadaId(null)
              onSeleccionChange(null)
              setMensaje('Se generará el PDF sin plantilla')
            }}
          >
            Sin plantilla
          </button>
          <button type="button" className="btn primary" onClick={onCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
