import { useEffect, useState } from 'react'
import { serializarFormulario } from '../lib/formularioSnapshot'
import { descargarPdf } from '../lib/generarPdf'
import {
  crearCarpeta,
  guardarEnHistorialPdf,
  listarCarpetas,
} from '../lib/historialPdfStore'
import { etiquetaComprobante, type DatosFormulario } from '../types/formulario'
import {
  nombreArchivoDesdeIdentificador,
  type PdfCarpeta,
} from '../types/historialPdf'

export type AjusteComprobantePreview = {
  id: string
  tipo: string
  escalaAncho: number
  escalaAlto: number
}

export type HistorialEditando = {
  id: string
  nombre: string
  carpetaId: string | null
}

type Props = {
  abierto: boolean
  url: string | null
  blob: Blob | null
  nombreArchivo: string
  nombreSugerido?: string
  datos: DatosFormulario
  historialEditando?: HistorialEditando | null
  regenerando?: boolean
  ajustesComprobantes: AjusteComprobantePreview[]
  onEscalaComprobanteChange: (
    id: string,
    eje: 'ancho' | 'alto',
    valor: number,
  ) => void
  onCerrar: () => void
  onGuardadoEnHistorial?: () => void
}

const NUEVA_CARPETA = '__nueva__'
const SIN_CARPETA = '__ninguna__'

export function ModalVistaPreviaPdf({
  abierto,
  url,
  blob,
  nombreArchivo,
  nombreSugerido = '',
  datos,
  historialEditando = null,
  regenerando = false,
  ajustesComprobantes,
  onEscalaComprobanteChange,
  onCerrar,
  onGuardadoEnHistorial,
}: Props) {
  const [escalasLocales, setEscalasLocales] = useState<
    Record<string, { ancho: number; alto: number }>
  >({})
  const [panelTamanosAbierto, setPanelTamanosAbierto] = useState(false)
  const [nombreHistorial, setNombreHistorial] = useState('')
  const [carpetas, setCarpetas] = useState<PdfCarpeta[]>([])
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(SIN_CARPETA)
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  useEffect(() => {
    const mapa: Record<string, { ancho: number; alto: number }> = {}
    for (const item of ajustesComprobantes) {
      mapa[item.id] = {
        ancho: item.escalaAncho,
        alto: item.escalaAlto,
      }
    }
    setEscalasLocales(mapa)
  }, [ajustesComprobantes, abierto])

  useEffect(() => {
    if (!abierto) return
    setPanelTamanosAbierto(false)
    setMensaje(null)
    setErrorLocal(null)
    setNombreNuevaCarpeta('')
    setNombreHistorial(
      historialEditando?.nombre.trim() ||
        nombreSugerido.trim() ||
        nombreArchivo.replace(/\.pdf$/i, '') ||
        'Resumen',
    )
    void listarCarpetas().then((lista) => {
      setCarpetas(lista)
      if (historialEditando?.carpetaId) {
        setCarpetaSeleccionada(historialEditando.carpetaId)
      } else {
        setCarpetaSeleccionada(lista[0]?.id ?? SIN_CARPETA)
      }
    })
  }, [abierto, nombreSugerido, nombreArchivo, historialEditando])

  useEffect(() => {
    if (!abierto) return
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abierto, onCerrar])

  if (!abierto || !url) return null

  async function descargarYGuardar() {
    if (!blob || !url) {
      setErrorLocal('No hay PDF para guardar. Regenerá la vista previa.')
      return
    }

    const urlPdf = url
    setGuardando(true)
    setErrorLocal(null)
    setMensaje(null)
    try {
      let carpetaId: string | null = null

      if (carpetaSeleccionada === NUEVA_CARPETA) {
        const nombreCarpeta = nombreNuevaCarpeta.trim()
        if (!nombreCarpeta) {
          setErrorLocal('Escribí el nombre de la carpeta nueva')
          setGuardando(false)
          return
        }
        const creada = await crearCarpeta(nombreCarpeta)
        carpetaId = creada.id
        setCarpetas((prev) =>
          [...prev, creada].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
          ),
        )
        setCarpetaSeleccionada(creada.id)
        setNombreNuevaCarpeta('')
      } else if (carpetaSeleccionada !== SIN_CARPETA) {
        carpetaId = carpetaSeleccionada
      }

      const bytes = await blob.arrayBuffer()
      const nombre = nombreHistorial.trim() || 'Sin nombre'
      const archivo = nombreArchivoDesdeIdentificador(nombre)
      const datosFormulario = await serializarFormulario(datos)
      await guardarEnHistorialPdf({
        nombre,
        bytes,
        carpetaId,
        nombreArchivoSugerido: archivo,
        datosFormulario,
        idExistente: historialEditando?.id ?? null,
      })
      descargarPdf(urlPdf, archivo)
      setMensaje(
        historialEditando
          ? 'PDF actualizado en Documentos\\resumenes'
          : 'PDF guardado en Documentos\\resumenes (no se pierde al actualizar)',
      )
      onGuardadoEnHistorial?.()
    } catch (err) {
      setErrorLocal(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el PDF en el historial',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="modal-adjunto modal-preview-pdf"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-preview-pdf-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-adjunto-cabecera">
          <h2 id="modal-preview-pdf-titulo">Vista previa del PDF</h2>
          <div className="preview-cabecera-acciones">
            {ajustesComprobantes.length > 0 ? (
              <button
                type="button"
                className={`btn ghost btn-tamanos${panelTamanosAbierto ? ' active' : ''}`}
                onClick={() => setPanelTamanosAbierto((v) => !v)}
              >
                {panelTamanosAbierto
                  ? 'Ocultar tamaños'
                  : `Ajustar tamaños (${ajustesComprobantes.length})`}
              </button>
            ) : null}
            <button type="button" className="btn-cerrar" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>

        {panelTamanosAbierto && ajustesComprobantes.length > 0 ? (
          <div className="ajustes-comprobantes">
            <p className="ajuste-comprobante-ayuda">
              Ajustá ancho y alto por separado (30% a 200%). Al soltar se
              actualiza la vista previa.
            </p>
            {ajustesComprobantes.map((item) => {
              const escala = escalasLocales[item.id] ?? {
                ancho: item.escalaAncho,
                alto: item.escalaAlto,
              }
              const idAncho = `escala-ancho-${item.id}`
              const idAlto = `escala-alto-${item.id}`
              return (
                <div key={item.id} className="ajuste-comprobante">
                  <strong className="ajuste-comprobante-titulo">
                    {etiquetaComprobante(item.tipo)}
                  </strong>
                  <label htmlFor={idAncho}>
                    Ancho: <strong>{escala.ancho}%</strong>
                  </label>
                  <input
                    id={idAncho}
                    type="range"
                    min={30}
                    max={200}
                    step={5}
                    value={escala.ancho}
                    disabled={regenerando}
                    onChange={(e) =>
                      setEscalasLocales((prev) => ({
                        ...prev,
                        [item.id]: {
                          ancho: Number(e.target.value),
                          alto: prev[item.id]?.alto ?? item.escalaAlto,
                        },
                      }))
                    }
                    onMouseUp={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'ancho',
                        Number(e.currentTarget.value),
                      )
                    }
                    onTouchEnd={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'ancho',
                        Number(e.currentTarget.value),
                      )
                    }
                    onKeyUp={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'ancho',
                        Number(e.currentTarget.value),
                      )
                    }
                  />
                  <label htmlFor={idAlto}>
                    Alto: <strong>{escala.alto}%</strong>
                  </label>
                  <input
                    id={idAlto}
                    type="range"
                    min={30}
                    max={200}
                    step={5}
                    value={escala.alto}
                    disabled={regenerando}
                    onChange={(e) =>
                      setEscalasLocales((prev) => ({
                        ...prev,
                        [item.id]: {
                          ancho: prev[item.id]?.ancho ?? item.escalaAncho,
                          alto: Number(e.target.value),
                        },
                      }))
                    }
                    onMouseUp={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'alto',
                        Number(e.currentTarget.value),
                      )
                    }
                    onTouchEnd={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'alto',
                        Number(e.currentTarget.value),
                      )
                    }
                    onKeyUp={(e) =>
                      onEscalaComprobanteChange(
                        item.id,
                        'alto',
                        Number(e.currentTarget.value),
                      )
                    }
                  />
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="preview-pdf-wrap">
          {regenerando ? (
            <div className="preview-pdf-loading">
              Actualizando vista previa...
            </div>
          ) : null}
          <iframe
            className="preview-pdf-frame"
            title="Vista previa del PDF generado"
            src={url}
          />
        </div>

        <div className="historial-guardar-campos">
          <div className="historial-nombre-campo">
            <label htmlFor="carpeta-historial-pdf">Carpeta</label>
            <select
              id="carpeta-historial-pdf"
              value={carpetaSeleccionada}
              onChange={(e) => setCarpetaSeleccionada(e.target.value)}
              disabled={regenerando || guardando}
            >
              <option value={SIN_CARPETA}>Sin carpeta</option>
              {carpetas.map((carpeta) => (
                <option key={carpeta.id} value={carpeta.id}>
                  {carpeta.nombre}
                </option>
              ))}
              <option value={NUEVA_CARPETA}>+ Nueva carpeta…</option>
            </select>
          </div>

          {carpetaSeleccionada === NUEVA_CARPETA ? (
            <div className="historial-nombre-campo">
              <label htmlFor="nueva-carpeta-historial-pdf">
                Nombre de la carpeta
              </label>
              <input
                id="nueva-carpeta-historial-pdf"
                type="text"
                value={nombreNuevaCarpeta}
                onChange={(e) => setNombreNuevaCarpeta(e.target.value)}
                placeholder="Ej: Cristian / Helga"
                disabled={regenerando || guardando}
              />
            </div>
          ) : null}

          <div className="historial-nombre-campo">
            <label htmlFor="nombre-historial-pdf">Nombre del PDF</label>
            <input
              id="nombre-historial-pdf"
              type="text"
              value={nombreHistorial}
              onChange={(e) => setNombreHistorial(e.target.value)}
              placeholder="Ej: Resumen Julio 2026"
              disabled={regenerando || guardando}
            />
            <p className="campo-ayuda">
              {historialEditando
                ? 'Estás editando un PDF del historial: al guardar se actualiza ese mismo.'
                : 'Elegí o creá la carpeta y el nombre del PDF antes de descargar.'}
            </p>
          </div>
        </div>

        {errorLocal ? <p className="form-error">{errorLocal}</p> : null}
        {mensaje ? <p className="historial-ok">{mensaje}</p> : null}

        <div className="modal-acciones">
          <button type="button" className="btn ghost" onClick={onCerrar}>
            Seguir editando
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={regenerando || guardando || !blob}
            onClick={() => void descargarYGuardar()}
          >
            {guardando
              ? 'Guardando...'
              : historialEditando
                ? 'Actualizar y descargar'
                : 'Descargar y guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
