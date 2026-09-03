import { useEffect, useState, type FormEvent } from 'react'
import { CampoConFuente } from './components/CampoConFuente'
import { CampoFecha } from './components/CampoFecha'
import { ModalAdjunto } from './components/ModalAdjunto'
import { ModalHistorialPdf } from './components/ModalHistorialPdf'
import { ModalPlantillas } from './components/ModalPlantillas'
import { ModalVistaPreviaPdf } from './components/ModalVistaPreviaPdf'
import {
  aplicarEstilosEstadosCuenta,
  cargarEstilosBloques,
  cargarEstilosGuardados,
  cargarTextoSinFacturacion,
  guardarEstilos,
  guardarEstilosBloques,
  guardarTextoSinFacturacion,
} from './lib/estilosGuardados'
import { generarPdf } from './lib/generarPdf'
import {
  obtenerPlantilla,
  obtenerPlantillaSeleccionadaId,
} from './lib/plantillasStore'
import {
  crearBloqueAdjunto,
  crearBloqueEstadoCuenta,
  ETIQUETA_ESTADO_CUENTA,
  ETIQUETA_FACTURACION,
  ETIQUETA_PAGO_ARCA,
  formularioInicial,
  type BloqueAdjunto,
  type BloqueEstadoCuenta,
  type DatosFormulario,
  type EstiloFuente,
} from './types/formulario'
import './App.css'

type CampoEstiloBase = keyof DatosFormulario['estilos']
type CampoTextoBase = 'fecha' | 'titulo' | 'resumen'
type GrupoBloque = 'comprobantes' | 'facturaciones'
type FuenteAbierta =
  | CampoEstiloBase
  | `bloque:${string}`
  | `estado:${string}:texto`
  | `estado:${string}:detalle`
  | null
type AdjuntoActivo =
  | { tipo: 'resumen' }
  | { tipo: 'estadoCuenta'; id: string }
  | { tipo: 'bloque'; grupo: GrupoBloque; id: string }

function aplicarEstilosGuardados(
  bloques: BloqueAdjunto[],
  estilosGuardados: Record<string, EstiloFuente>,
): BloqueAdjunto[] {
  return bloques.map((item) => ({
    ...item,
    estilo: estilosGuardados[item.etiqueta]
      ? { ...estilosGuardados[item.etiqueta]! }
      : item.estilo,
  }))
}

function App() {
  const [datos, setDatos] = useState<DatosFormulario>(() => {
    const estilos = cargarEstilosGuardados()
    const estilosBloques = cargarEstilosBloques()
    return {
      ...formularioInicial,
      estilos,
      textoSinFacturacion: cargarTextoSinFacturacion(),
      comprobantes: aplicarEstilosGuardados(
        formularioInicial.comprobantes,
        estilosBloques,
      ),
      facturaciones: aplicarEstilosGuardados(
        formularioInicial.facturaciones,
        estilosBloques,
      ),
      estadosCuenta: aplicarEstilosEstadosCuenta(
        formularioInicial.estadosCuenta,
        estilosBloques,
      ),
    }
  })
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fuenteAbierta, setFuenteAbierta] = useState<FuenteAbierta>(null)
  const [adjuntoActivo, setAdjuntoActivo] = useState<AdjuntoActivo | null>(null)
  const [modalPlantillasAbierto, setModalPlantillasAbierto] = useState(false)
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<
    string | null
  >(() => obtenerPlantillaSeleccionadaId())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewNombre, setPreviewNombre] = useState('resumen.pdf')
  const [regenerandoPreview, setRegenerandoPreview] = useState(false)
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false)
  const [historialEditando, setHistorialEditando] = useState<{
    id: string
    nombre: string
    carpetaId: string | null
  } | null>(null)

  useEffect(() => {
    guardarEstilos(datos.estilos)
  }, [datos.estilos])

  useEffect(() => {
    guardarEstilosBloques(
      [...datos.comprobantes, ...datos.facturaciones],
      datos.estadosCuenta,
    )
  }, [datos.comprobantes, datos.facturaciones, datos.estadosCuenta])

  useEffect(() => {
    guardarTextoSinFacturacion(datos.textoSinFacturacion)
  }, [datos.textoSinFacturacion])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function actualizarTexto(campo: CampoTextoBase, valor: string) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  function actualizarEstilo(campo: CampoEstiloBase, estilo: EstiloFuente) {
    setDatos((prev) => ({
      ...prev,
      estilos: {
        ...prev.estilos,
        [campo]: estilo,
      },
    }))
  }

  function actualizarBloque(
    grupo: GrupoBloque,
    id: string,
    cambios: Partial<BloqueAdjunto>,
  ) {
    setDatos((prev) => ({
      ...prev,
      [grupo]: prev[grupo].map((item) =>
        item.id === id ? { ...item, ...cambios } : item,
      ),
    }))
  }

  function agregarBloque(grupo: GrupoBloque, etiqueta: string) {
    setDatos((prev) => {
      const referencia = [...prev[grupo]].reverse()[0]
      const nuevo = crearBloqueAdjunto(etiqueta)
      if (referencia) nuevo.estilo = { ...referencia.estilo }
      return {
        ...prev,
        [grupo]: [...prev[grupo], nuevo],
      }
    })
  }

  function quitarBloque(grupo: GrupoBloque, id: string) {
    setDatos((prev) => {
      if (prev[grupo].length <= 1) return prev
      return {
        ...prev,
        [grupo]: prev[grupo].filter((item) => item.id !== id),
      }
    })
    setFuenteAbierta((actual) => (actual === `bloque:${id}` ? null : actual))
  }

  function actualizarEstadoCuenta(
    id: string,
    cambios: Partial<BloqueEstadoCuenta>,
  ) {
    setDatos((prev) => ({
      ...prev,
      estadosCuenta: prev.estadosCuenta.map((item) =>
        item.id === id ? { ...item, ...cambios } : item,
      ),
    }))
  }

  function agregarEstadoCuenta() {
    setDatos((prev) => {
      const referencia = [...prev.estadosCuenta].reverse()[0]
      const nuevo = crearBloqueEstadoCuenta()
      if (referencia) {
        nuevo.estilo = { ...referencia.estilo }
        nuevo.estiloDetalle = { ...referencia.estiloDetalle }
      }
      return {
        ...prev,
        estadosCuenta: [...prev.estadosCuenta, nuevo],
      }
    })
  }

  function quitarEstadoCuenta(id: string) {
    setDatos((prev) => {
      if (prev.estadosCuenta.length <= 1) return prev
      return {
        ...prev,
        estadosCuenta: prev.estadosCuenta.filter((item) => item.id !== id),
      }
    })
    setFuenteAbierta((actual) =>
      actual === `estado:${id}:texto` || actual === `estado:${id}:detalle`
        ? null
        : actual,
    )
  }

  function cerrarPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewBlob(null)
  }

  function cargarDesdeHistorial(
    datosHistorial: DatosFormulario,
    meta: { id: string; nombre: string; carpetaId: string | null },
  ) {
    setDatos(datosHistorial)
    setHistorialEditando({
      id: meta.id,
      nombre: meta.nombre,
      carpetaId: meta.carpetaId,
    })
    setFuenteAbierta(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function generarVistaPrevia(datosActuales: DatosFormulario) {
    const plantilla = plantillaSeleccionadaId
      ? await obtenerPlantilla(plantillaSeleccionadaId)
      : null
    const resultado = await generarPdf(datosActuales, plantilla)
    setPreviewUrl((urlAnterior) => {
      if (urlAnterior) URL.revokeObjectURL(urlAnterior)
      return resultado.url
    })
    setPreviewBlob(resultado.blob)
    setPreviewNombre(resultado.nombreArchivo)
  }

  async function finalizar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setGenerando(true)

    try {
      await generarVistaPrevia(datos)
    } catch (err) {
      const crudo =
        err instanceof Error ? err.message : 'No se pudo generar el PDF'
      const message = /flate stream|compression method/i.test(crudo)
        ? 'No se pudo leer ese PDF adjunto. Probá con otro archivo o una captura/imagen.'
        : crudo
      setError(message)
    } finally {
      setGenerando(false)
    }
  }

  async function onEscalaAdjuntoChange(
    id: string,
    eje: 'ancho' | 'alto',
    valor: number,
  ) {
    const siguientes: DatosFormulario = {
      ...datos,
      escalaResumenAncho:
        id === 'resumen' && eje === 'ancho' ? valor : datos.escalaResumenAncho,
      escalaResumenAlto:
        id === 'resumen' && eje === 'alto' ? valor : datos.escalaResumenAlto,
      comprobantes: datos.comprobantes.map((item) =>
        item.id === id
          ? {
              ...item,
              escalaAncho: eje === 'ancho' ? valor : item.escalaAncho,
              escalaAlto: eje === 'alto' ? valor : item.escalaAlto,
            }
          : item,
      ),
      facturaciones: datos.facturaciones.map((item) =>
        item.id === id
          ? {
              ...item,
              escalaAncho: eje === 'ancho' ? valor : item.escalaAncho,
              escalaAlto: eje === 'alto' ? valor : item.escalaAlto,
            }
          : item,
      ),
      estadosCuenta: datos.estadosCuenta.map((item) =>
        item.id === id
          ? {
              ...item,
              escalaAncho: eje === 'ancho' ? valor : item.escalaAncho,
              escalaAlto: eje === 'alto' ? valor : item.escalaAlto,
            }
          : item,
      ),
    }
    setDatos(siguientes)
    setRegenerandoPreview(true)
    setError(null)

    try {
      await generarVistaPrevia(siguientes)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la vista previa'
      setError(message)
    } finally {
      setRegenerandoPreview(false)
    }
  }

  const archivoModal =
    adjuntoActivo?.tipo === 'resumen'
      ? datos.adjuntoResumen
      : adjuntoActivo?.tipo === 'estadoCuenta'
        ? (datos.estadosCuenta.find((item) => item.id === adjuntoActivo.id)
            ?.adjunto ?? null)
        : adjuntoActivo?.tipo === 'bloque'
          ? (datos[adjuntoActivo.grupo].find(
              (item) => item.id === adjuntoActivo.id,
            )?.adjunto ?? null)
          : null

  const todosBloques = [
    ...(datos.adjuntoResumen
      ? [
          {
            id: 'resumen',
            etiqueta: 'RESUMEN',
            adjunto: datos.adjuntoResumen,
            escalaAncho: datos.escalaResumenAncho,
            escalaAlto: datos.escalaResumenAlto,
          },
        ]
      : []),
    ...datos.comprobantes,
    ...datos.facturaciones,
    ...datos.estadosCuenta.map((item) => ({
      id: item.id,
      etiqueta: ETIQUETA_ESTADO_CUENTA,
      adjunto: item.adjunto,
      escalaAncho: item.escalaAncho,
      escalaAlto: item.escalaAlto,
    })),
  ]
  const conteoPorEtiqueta: Record<string, number> = {}
  const ajustesComprobantes = todosBloques
    .filter((item) => item.adjunto)
    .map((item) => {
      conteoPorEtiqueta[item.etiqueta] =
        (conteoPorEtiqueta[item.etiqueta] ?? 0) + 1
      const total = todosBloques.filter(
        (b) => b.etiqueta === item.etiqueta && b.adjunto,
      ).length
      const numero = conteoPorEtiqueta[item.etiqueta] ?? 1
      return {
        id: item.id,
        tipo: total > 1 ? `${item.etiqueta} (${numero})` : item.etiqueta,
        escalaAncho: item.escalaAncho,
        escalaAlto: item.escalaAlto,
      }
    })

  function renderGrupoBloques(
    grupo: GrupoBloque,
    etiqueta: string,
    textoAgregar: string,
  ) {
    const lista = datos[grupo]
    return (
      <>
        {lista.map((bloque, index) => {
          const claveFuente = `bloque:${bloque.id}` as const
          const etiquetaVisible =
            lista.length > 1 ? `${bloque.etiqueta} (${index + 1})` : bloque.etiqueta

          return (
            <div key={bloque.id} className="bloque-comprobante">
              <div className="campo-con-adjunto">
                <CampoConFuente
                  etiqueta={etiquetaVisible}
                  valor={bloque.texto}
                  estilo={bloque.estilo}
                  placeholder="Texto del campo"
                  panelAbierto={fuenteAbierta === claveFuente}
                  onToggleFuente={() =>
                    setFuenteAbierta((actual) =>
                      actual === claveFuente ? null : claveFuente,
                    )
                  }
                  onValorChange={(valor) =>
                    actualizarBloque(grupo, bloque.id, { texto: valor })
                  }
                  onEstiloChange={(estilo) =>
                    actualizarBloque(grupo, bloque.id, { estilo })
                  }
                />

                <div className="campo-adjunto">
                  <span className="campo-adjunto-label">
                    Archivo / captura
                  </span>
                  <button
                    type="button"
                    className="btn-adjunto"
                    onClick={() =>
                      setAdjuntoActivo({
                        tipo: 'bloque',
                        grupo,
                        id: bloque.id,
                      })
                    }
                  >
                    {bloque.adjunto
                      ? 'Cambiar archivo'
                      : 'Cargar archivo o captura'}
                  </button>
                  <button
                    type="button"
                    className={`btn-pagina-nueva${bloque.nuevaPaginaAntes ? ' active' : ''}`}
                    title="Si está activo, este bloque empieza en una página nueva del PDF"
                    onClick={() =>
                      actualizarBloque(grupo, bloque.id, {
                        nuevaPaginaAntes: !bloque.nuevaPaginaAntes,
                      })
                    }
                  >
                    {bloque.nuevaPaginaAntes
                      ? 'Página nueva: sí'
                      : 'Empezar en página nueva'}
                  </button>
                  <span className="adjunto-nombre">
                    {bloque.adjunto ? bloque.adjunto.name : 'Sin archivo'}
                  </span>
                </div>
              </div>

              {lista.length > 1 ? (
                <button
                  type="button"
                  className="btn-quitar-comprobante"
                  onClick={() => quitarBloque(grupo, bloque.id)}
                >
                  Quitar este campo
                </button>
              ) : null}
            </div>
          )
        })}

        <button
          type="button"
          className="btn-agregar-comprobante"
          onClick={() => agregarBloque(grupo, etiqueta)}
        >
          {textoAgregar}
        </button>
      </>
    )
  }

  return (
    <div className="shell">
      <header className="brand">
        <p className="brand-name">GENERACION DE RESUMEN</p>
      </header>

      <main className="panel">
        {historialEditando ? (
          <div className="aviso-edicion-historial">
            <p>
              Editando el PDF del historial:{' '}
              <strong>{historialEditando.nombre}</strong>
            </p>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setHistorialEditando(null)}
            >
              Dejar de editar (guardar como nuevo)
            </button>
          </div>
        ) : null}
        <form className="formulario" onSubmit={finalizar}>
          <section className="fields">
            <CampoFecha
              etiqueta="Fecha"
              valor={datos.fecha}
              estilo={datos.estilos.fecha}
              placeholder="dd/mm/aaaa"
              panelAbierto={fuenteAbierta === 'fecha'}
              onToggleFuente={() =>
                setFuenteAbierta((actual) =>
                  actual === 'fecha' ? null : 'fecha',
                )
              }
              onValorChange={(valor) => actualizarTexto('fecha', valor)}
              onEstiloChange={(estilo) => actualizarEstilo('fecha', estilo)}
            />

            <CampoConFuente
              etiqueta="Título"
              valor={datos.titulo}
              estilo={datos.estilos.titulo}
              panelAbierto={fuenteAbierta === 'titulo'}
              onToggleFuente={() =>
                setFuenteAbierta((actual) =>
                  actual === 'titulo' ? null : 'titulo',
                )
              }
              onValorChange={(valor) => actualizarTexto('titulo', valor)}
              onEstiloChange={(estilo) => actualizarEstilo('titulo', estilo)}
            />

            <div className="campo-con-adjunto">
              <CampoConFuente
                etiqueta="RESUMEN"
                valor={datos.resumen}
                estilo={datos.estilos.resumen}
                panelAbierto={fuenteAbierta === 'resumen'}
                onToggleFuente={() =>
                  setFuenteAbierta((actual) =>
                    actual === 'resumen' ? null : 'resumen',
                  )
                }
                onValorChange={(valor) => actualizarTexto('resumen', valor)}
                onEstiloChange={(estilo) => actualizarEstilo('resumen', estilo)}
              />

              <div className="campo-adjunto">
                <span className="campo-adjunto-label">Archivo / captura</span>
                <button
                  type="button"
                  className="btn-adjunto"
                  onClick={() => setAdjuntoActivo({ tipo: 'resumen' })}
                >
                  {datos.adjuntoResumen
                    ? 'Cambiar archivo'
                    : 'Cargar archivo o captura'}
                </button>
                <button
                  type="button"
                  className={`btn-pagina-nueva${datos.nuevaPaginaAntesResumen ? ' active' : ''}`}
                  title="Si está activo, RESUMEN empieza en una página nueva del PDF"
                  onClick={() =>
                    setDatos((prev) => ({
                      ...prev,
                      nuevaPaginaAntesResumen: !prev.nuevaPaginaAntesResumen,
                    }))
                  }
                >
                  {datos.nuevaPaginaAntesResumen
                    ? 'Página nueva: sí'
                    : 'Empezar en página nueva'}
                </button>
                <span className="adjunto-nombre">
                  {datos.adjuntoResumen
                    ? datos.adjuntoResumen.name
                    : 'Sin archivo'}
                </span>
              </div>
            </div>

            <div className="seccion-campos">
              {renderGrupoBloques(
                'comprobantes',
                ETIQUETA_PAGO_ARCA,
                `+ Agregar ${ETIQUETA_PAGO_ARCA}`,
              )}
            </div>

            <div className="seccion-campos">
              {renderGrupoBloques(
                'facturaciones',
                ETIQUETA_FACTURACION,
                `+ Agregar ${ETIQUETA_FACTURACION}`,
              )}

              <CampoConFuente
                etiqueta="Texto si no hay archivo de facturación"
                valor={datos.textoSinFacturacion}
                estilo={datos.estilos.sinFacturacion}
                placeholder="SIN FACTURACION"
                panelAbierto={fuenteAbierta === 'sinFacturacion'}
                onToggleFuente={() =>
                  setFuenteAbierta((actual) =>
                    actual === 'sinFacturacion' ? null : 'sinFacturacion',
                  )
                }
                onValorChange={(valor) =>
                  setDatos((prev) => ({ ...prev, textoSinFacturacion: valor }))
                }
                onEstiloChange={(estilo) =>
                  actualizarEstilo('sinFacturacion', estilo)
                }
              />
              <p className="campo-ayuda">
                Si completás el texto de facturación y no adjuntás archivo, este
                texto aparece a la izquierda en el PDF (podés dejarlo vacío para
                omitirlo).
              </p>
            </div>

            <div className="seccion-campos">
              {datos.estadosCuenta.map((estado, index) => {
              const claveTexto = `estado:${estado.id}:texto` as const
              const claveDetalle = `estado:${estado.id}:detalle` as const
              const etiquetaVisible =
                datos.estadosCuenta.length > 1
                  ? `${ETIQUETA_ESTADO_CUENTA} (${index + 1})`
                  : ETIQUETA_ESTADO_CUENTA

              return (
                <div key={estado.id} className="bloque-estado-cuenta">
                  <CampoConFuente
                    etiqueta={etiquetaVisible}
                    valor={estado.texto}
                    estilo={estado.estilo}
                    placeholder="Opcional"
                    panelAbierto={fuenteAbierta === claveTexto}
                    onToggleFuente={() =>
                      setFuenteAbierta((actual) =>
                        actual === claveTexto ? null : claveTexto,
                      )
                    }
                    onValorChange={(valor) =>
                      actualizarEstadoCuenta(estado.id, { texto: valor })
                    }
                    onEstiloChange={(estilo) =>
                      actualizarEstadoCuenta(estado.id, { estilo })
                    }
                  />

                  <CampoConFuente
                    etiqueta="DETALLE"
                    valor={estado.detalle}
                    estilo={estado.estiloDetalle}
                    placeholder="Texto opcional (no se imprime el título DETALLE)"
                    multilinea
                    filas={5}
                    panelAbierto={fuenteAbierta === claveDetalle}
                    onToggleFuente={() =>
                      setFuenteAbierta((actual) =>
                        actual === claveDetalle ? null : claveDetalle,
                      )
                    }
                    onValorChange={(valor) =>
                      actualizarEstadoCuenta(estado.id, { detalle: valor })
                    }
                    onEstiloChange={(estiloDetalle) =>
                      actualizarEstadoCuenta(estado.id, { estiloDetalle })
                    }
                  />

                  <div className="campo-adjunto">
                    <span className="campo-adjunto-label">
                      Archivo / captura
                    </span>
                    <button
                      type="button"
                      className="btn-adjunto"
                      onClick={() =>
                        setAdjuntoActivo({
                          tipo: 'estadoCuenta',
                          id: estado.id,
                        })
                      }
                    >
                      {estado.adjunto
                        ? 'Cambiar archivo'
                        : 'Cargar archivo o captura'}
                    </button>
                    <button
                      type="button"
                      className={`btn-pagina-nueva${estado.nuevaPaginaAntes ? ' active' : ''}`}
                      title="Si está activo, este estado de cuenta empieza en una página nueva del PDF"
                      onClick={() =>
                        actualizarEstadoCuenta(estado.id, {
                          nuevaPaginaAntes: !estado.nuevaPaginaAntes,
                        })
                      }
                    >
                      {estado.nuevaPaginaAntes
                        ? 'Página nueva: sí'
                        : 'Empezar en página nueva'}
                    </button>
                    <span className="adjunto-nombre">
                      {estado.adjunto ? estado.adjunto.name : 'Sin archivo'}
                    </span>
                  </div>

                  {datos.estadosCuenta.length > 1 ? (
                    <button
                      type="button"
                      className="btn-quitar-comprobante"
                      onClick={() => quitarEstadoCuenta(estado.id)}
                    >
                      Quitar este estado de cuenta
                    </button>
                  ) : null}
                </div>
              )
            })}

              <button
                type="button"
                className="btn-agregar-comprobante"
                onClick={agregarEstadoCuenta}
              >
                {`+ Agregar ${ETIQUETA_ESTADO_CUENTA}`}
              </button>
            </div>
          </section>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="actions">
            <button type="submit" className="btn primary" disabled={generando}>
              {generando ? 'Generando...' : 'Vista previa PDF'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setModalPlantillasAbierto(true)}
            >
              Plantillas
              {plantillaSeleccionadaId ? ' · activa' : ''}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setModalHistorialAbierto(true)}
            >
              Historial PDF
            </button>
          </div>
        </form>
      </main>

      <ModalAdjunto
        abierto={adjuntoActivo !== null}
        archivoActual={archivoModal}
        onCerrar={() => setAdjuntoActivo(null)}
        onConfirmar={(archivo) => {
          if (!adjuntoActivo) return
          if (adjuntoActivo.tipo === 'resumen') {
            setDatos((prev) => ({ ...prev, adjuntoResumen: archivo }))
          } else if (adjuntoActivo.tipo === 'estadoCuenta') {
            actualizarEstadoCuenta(adjuntoActivo.id, { adjunto: archivo })
          } else {
            actualizarBloque(adjuntoActivo.grupo, adjuntoActivo.id, {
              adjunto: archivo,
            })
          }
          setAdjuntoActivo(null)
        }}
      />

      <ModalPlantillas
        abierto={modalPlantillasAbierto}
        seleccionadaId={plantillaSeleccionadaId}
        onCerrar={() => setModalPlantillasAbierto(false)}
        onSeleccionChange={setPlantillaSeleccionadaId}
      />

      <ModalHistorialPdf
        abierto={modalHistorialAbierto}
        onCerrar={() => setModalHistorialAbierto(false)}
        onEditar={(datosHistorial, meta) => {
          cargarDesdeHistorial(datosHistorial, meta)
        }}
      />

      <ModalVistaPreviaPdf
        abierto={previewUrl !== null}
        url={previewUrl}
        blob={previewBlob}
        nombreArchivo={previewNombre}
        nombreSugerido={
          datos.titulo.trim() ||
          (datos.fecha.trim() ? `Resumen ${datos.fecha.trim()}` : '')
        }
        datos={datos}
        historialEditando={historialEditando}
        regenerando={regenerandoPreview}
        ajustesComprobantes={ajustesComprobantes}
        onEscalaComprobanteChange={(id, eje, valor) => {
          void onEscalaAdjuntoChange(id, eje, valor)
        }}
        onCerrar={cerrarPreview}
        onGuardadoEnHistorial={() => {
          // Tras actualizar/guardar, se mantiene el vínculo por si regenera de nuevo
        }}
      />
    </div>
  )
}

export default App
