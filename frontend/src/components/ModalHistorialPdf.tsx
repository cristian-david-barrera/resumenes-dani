import { useEffect, useState } from 'react'
import { deserializarFormulario } from '../lib/formularioSnapshot'
import { descargarPdf } from '../lib/generarPdf'
import {
  contarPdfsPorCarpeta,
  crearCarpeta,
  eliminarCarpeta,
  eliminarHistorialPdf,
  listarCarpetas,
  listarHistorialPdf,
  obtenerHistorialPdf,
  renombrarCarpeta,
  renombrarHistorialPdf,
} from '../lib/historialPdfStore'
import type { DatosFormulario } from '../types/formulario'
import type { PdfCarpeta, PdfHistorialMeta } from '../types/historialPdf'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onEditar: (datos: DatosFormulario, meta: PdfHistorialMeta) => void
}

function formatearFecha(ms: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms))
}

function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ModalHistorialPdf({ abierto, onCerrar, onEditar }: Props) {
  const [carpetas, setCarpetas] = useState<PdfCarpeta[]>([])
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const [carpetaActual, setCarpetaActual] = useState<PdfCarpeta | null>(null)
  const [viendoSinCarpeta, setViendoSinCarpeta] = useState(false)
  const [items, setItems] = useState<PdfHistorialMeta[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevaCarpeta, setNuevaCarpeta] = useState('')
  const [editandoCarpetaId, setEditandoCarpetaId] = useState<string | null>(
    null,
  )
  const [editandoPdfId, setEditandoPdfId] = useState<string | null>(null)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [vistaUrl, setVistaUrl] = useState<string | null>(null)
  const [vistaNombre, setVistaNombre] = useState('')

  const dentroDeCarpeta = carpetaActual !== null || viendoSinCarpeta

  async function refrescarRaiz() {
    const [lista, mapa] = await Promise.all([
      listarCarpetas(),
      contarPdfsPorCarpeta(),
    ])
    setCarpetas(lista)
    setConteos(mapa)
  }

  async function refrescarPdfs(carpetaId: string | null) {
    const lista = await listarHistorialPdf(carpetaId)
    setItems(lista)
  }

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setEditandoCarpetaId(null)
    setEditandoPdfId(null)
    setCarpetaActual(null)
    setViendoSinCarpeta(false)
    setVistaUrl((url) => {
      if (url) URL.revokeObjectURL(url)
      return null
    })
    void refrescarRaiz()
  }, [abierto])

  useEffect(() => {
    if (!abierto || !dentroDeCarpeta) return
    void refrescarPdfs(carpetaActual?.id ?? null)
  }, [abierto, dentroDeCarpeta, carpetaActual?.id])

  useEffect(() => {
    if (!abierto) return
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      if (vistaUrl) {
        URL.revokeObjectURL(vistaUrl)
        setVistaUrl(null)
        return
      }
      if (dentroDeCarpeta) {
        setCarpetaActual(null)
        setViendoSinCarpeta(false)
        setEditandoPdfId(null)
        void refrescarRaiz()
        return
      }
      onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abierto, onCerrar, vistaUrl, dentroDeCarpeta])

  useEffect(() => {
    return () => {
      if (vistaUrl) URL.revokeObjectURL(vistaUrl)
    }
  }, [vistaUrl])

  if (!abierto) return null

  async function onCrearCarpeta() {
    const nombre = nuevaCarpeta.trim()
    if (!nombre) {
      setError('Escribí un nombre para la carpeta')
      return
    }
    setCargando(true)
    setError(null)
    try {
      await crearCarpeta(nombre)
      setNuevaCarpeta('')
      await refrescarRaiz()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear la carpeta',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onGuardarNombreCarpeta(id: string) {
    setCargando(true)
    setError(null)
    try {
      await renombrarCarpeta(id, nombreEdicion)
      setEditandoCarpetaId(null)
      await refrescarRaiz()
      if (carpetaActual?.id === id) {
        setCarpetaActual((prev) =>
          prev ? { ...prev, nombre: nombreEdicion.trim() || prev.nombre } : prev,
        )
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo renombrar la carpeta',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onEliminarCarpeta(id: string, nombre: string) {
    const ok = window.confirm(
      `¿Eliminar la carpeta "${nombre}" y todos los PDF que tiene adentro?`,
    )
    if (!ok) return
    setCargando(true)
    setError(null)
    try {
      await eliminarCarpeta(id)
      if (carpetaActual?.id === id) {
        setCarpetaActual(null)
      }
      await refrescarRaiz()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar la carpeta',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onAbrir(id: string) {
    setCargando(true)
    setError(null)
    try {
      const item = await obtenerHistorialPdf(id)
      if (!item) {
        setError('No se encontró el PDF en el historial')
        return
      }
      if (vistaUrl) URL.revokeObjectURL(vistaUrl)
      const blob = new Blob([item.bytes], { type: 'application/pdf' })
      setVistaUrl(URL.createObjectURL(blob))
      setVistaNombre(item.nombre)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el PDF')
    } finally {
      setCargando(false)
    }
  }

  async function onDescargar(id: string) {
    setCargando(true)
    setError(null)
    try {
      const item = await obtenerHistorialPdf(id)
      if (!item) {
        setError('No se encontró el PDF en el historial')
        return
      }
      const blob = new Blob([item.bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      descargarPdf(url, item.nombreArchivo)
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo descargar el PDF',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onGuardarNombrePdf(id: string) {
    setCargando(true)
    setError(null)
    try {
      await renombrarHistorialPdf(id, nombreEdicion)
      setEditandoPdfId(null)
      await refrescarPdfs(carpetaActual?.id ?? null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo renombrar el PDF',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onEditarPdf(id: string) {
    setCargando(true)
    setError(null)
    try {
      const item = await obtenerHistorialPdf(id)
      if (!item?.datosFormulario) {
        setError(
          'Este PDF se guardó antes de poder editarlo. Generá uno nuevo con "Descargar y guardar".',
        )
        return
      }
      const datos = deserializarFormulario(item.datosFormulario)
      onEditar(datos, {
        id: item.id,
        carpetaId: item.carpetaId ?? null,
        nombre: item.nombre,
        nombreArchivo: item.nombreArchivo,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        tamanioBytes: item.bytes.byteLength,
        editable: true,
      })
      onCerrar()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el PDF para editar',
      )
    } finally {
      setCargando(false)
    }
  }

  async function onEliminarPdf(id: string) {
    if (!window.confirm('¿Eliminar este PDF del historial?')) return
    setCargando(true)
    setError(null)
    try {
      await eliminarHistorialPdf(id)
      await refrescarPdfs(carpetaActual?.id ?? null)
      await refrescarRaiz()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar el PDF',
      )
    } finally {
      setCargando(false)
    }
  }

  function volverACarpetas() {
    setCarpetaActual(null)
    setViendoSinCarpeta(false)
    setEditandoPdfId(null)
    setVistaUrl((url) => {
      if (url) URL.revokeObjectURL(url)
      return null
    })
    void refrescarRaiz()
  }

  const tituloActual = carpetaActual?.nombre ?? 'Sin carpeta'
  const sinCarpetaCount = conteos.__sin_carpeta__ ?? 0

  return (
    <div className="modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="modal-adjunto modal-historial-pdf"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-historial-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-adjunto-cabecera">
          <h2 id="modal-historial-titulo">
            {dentroDeCarpeta ? tituloActual : 'Historial de PDF'}
          </h2>
          <button type="button" className="btn-cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        <p className="historial-ayuda">
          {dentroDeCarpeta
            ? 'PDF guardados en esta carpeta. Podés editarlos (vuelven al formulario), renombrarlos, abrirlos o descargarlos.'
            : 'Organizá por carpetas (por persona u otro criterio). Dentro de cada una guardás los PDF con el nombre que quieras.'}
        </p>

        {dentroDeCarpeta ? (
          <button
            type="button"
            className="btn ghost btn-volver-historial"
            onClick={volverACarpetas}
          >
            ← Volver a carpetas
          </button>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        {vistaUrl ? (
          <div className="historial-vista">
            <div className="historial-vista-cabecera">
              <strong>{vistaNombre}</strong>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  URL.revokeObjectURL(vistaUrl)
                  setVistaUrl(null)
                }}
              >
                Volver al listado
              </button>
            </div>
            <iframe
              className="preview-pdf-frame historial-iframe"
              title="PDF del historial"
              src={vistaUrl}
            />
          </div>
        ) : !dentroDeCarpeta ? (
          <>
            <div className="historial-nueva-carpeta">
              <input
                type="text"
                value={nuevaCarpeta}
                onChange={(e) => setNuevaCarpeta(e.target.value)}
                placeholder="Nombre de carpeta (ej. persona)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onCrearCarpeta()
                }}
              />
              <button
                type="button"
                className="btn primary"
                disabled={cargando}
                onClick={() => void onCrearCarpeta()}
              >
                Crear carpeta
              </button>
            </div>

            <div className="lista-historial">
              {carpetas.map((carpeta) => (
                <div key={carpeta.id} className="item-historial item-carpeta">
                  <div className="item-historial-info">
                    {editandoCarpetaId === carpeta.id ? (
                      <input
                        type="text"
                        value={nombreEdicion}
                        autoFocus
                        onChange={(e) => setNombreEdicion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void onGuardarNombreCarpeta(carpeta.id)
                          }
                          if (e.key === 'Escape') setEditandoCarpetaId(null)
                        }}
                      />
                    ) : (
                      <strong>{carpeta.nombre}</strong>
                    )}
                    <span>
                      {conteos[carpeta.id] ?? 0} PDF · creada{' '}
                      {formatearFecha(carpeta.createdAt)}
                    </span>
                  </div>
                  <div className="item-historial-acciones">
                    {editandoCarpetaId === carpeta.id ? (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={cargando}
                          onClick={() => void onGuardarNombreCarpeta(carpeta.id)}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setEditandoCarpetaId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => {
                            setCarpetaActual(carpeta)
                            setViendoSinCarpeta(false)
                          }}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setEditandoCarpetaId(carpeta.id)
                            setNombreEdicion(carpeta.nombre)
                          }}
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={cargando}
                          onClick={() =>
                            void onEliminarCarpeta(carpeta.id, carpeta.nombre)
                          }
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {sinCarpetaCount > 0 ? (
                <div className="item-historial item-carpeta">
                  <div className="item-historial-info">
                    <strong>Sin carpeta</strong>
                    <span>{sinCarpetaCount} PDF sin asignar</span>
                  </div>
                  <div className="item-historial-acciones">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        setCarpetaActual(null)
                        setViendoSinCarpeta(true)
                      }}
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              ) : null}

              {carpetas.length === 0 && sinCarpetaCount === 0 ? (
                <p className="historial-vacio">
                  Todavía no hay carpetas. Creá una (por ejemplo con el nombre
                  de una persona) y después guardá PDF adentro al descargar.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="lista-historial">
            {items.length === 0 ? (
              <p className="historial-vacio">
                Esta carpeta está vacía. Al descargar un PDF elegí esta carpeta
                y un nombre para guardarlo acá.
              </p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="item-historial">
                  <div className="item-historial-info">
                    {editandoPdfId === item.id ? (
                      <input
                        type="text"
                        value={nombreEdicion}
                        autoFocus
                        onChange={(e) => setNombreEdicion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void onGuardarNombrePdf(item.id)
                          if (e.key === 'Escape') setEditandoPdfId(null)
                        }}
                        placeholder="Nombre del PDF"
                      />
                    ) : (
                      <strong>{item.nombre}</strong>
                    )}
                    <span>
                      {formatearFecha(item.createdAt)} ·{' '}
                      {formatearTamanio(item.tamanioBytes)}
                    </span>
                  </div>
                  <div className="item-historial-acciones">
                    {editandoPdfId === item.id ? (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={cargando}
                          onClick={() => void onGuardarNombrePdf(item.id)}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setEditandoPdfId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={cargando || !item.editable}
                          title={
                            item.editable
                              ? 'Cargar en el formulario para modificar'
                              : 'Este PDF no se puede editar (guardado sin datos del formulario)'
                          }
                          onClick={() => void onEditarPdf(item.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={cargando}
                          onClick={() => {
                            setEditandoPdfId(item.id)
                            setNombreEdicion(item.nombre)
                          }}
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={cargando}
                          onClick={() => void onAbrir(item.id)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={cargando}
                          onClick={() => void onDescargar(item.id)}
                        >
                          Descargar
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={cargando}
                          onClick={() => void onEliminarPdf(item.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
