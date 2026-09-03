import {
  crearBloqueAdjunto,
  crearBloqueEstadoCuenta,
  formularioInicial,
  type BloqueAdjunto,
  type BloqueEstadoCuenta,
  type DatosFormulario,
  type EstiloFuente,
} from '../types/formulario'

export type ArchivoGuardado = {
  name: string
  type: string
  bytes: ArrayBuffer
}

type EscalasGuardadas = {
  escalaAncho: number
  escalaAlto: number
  /** Compatibilidad con historial viejo. */
  escala?: number
}

type BloqueAdjuntoGuardado = Omit<
  BloqueAdjunto,
  'adjunto' | 'escalaAncho' | 'escalaAlto'
> &
  EscalasGuardadas & {
    adjunto: ArchivoGuardado | null
  }

type BloqueEstadoCuentaGuardado = Omit<
  BloqueEstadoCuenta,
  'adjunto' | 'escalaAncho' | 'escalaAlto'
> &
  EscalasGuardadas & {
    adjunto: ArchivoGuardado | null
  }

/** Snapshot serializable del formulario para poder reeditar un PDF del historial. */
export type DatosFormularioGuardado = {
  version: 1
  fecha: string
  titulo: string
  resumen: string
  adjuntoResumen: ArchivoGuardado | null
  escalaResumenAncho?: number
  escalaResumenAlto?: number
  nuevaPaginaAntesResumen?: boolean
  comprobantes: BloqueAdjuntoGuardado[]
  facturaciones: BloqueAdjuntoGuardado[]
  textoSinFacturacion: string
  estadosCuenta: BloqueEstadoCuentaGuardado[]
  estilos: DatosFormulario['estilos']
}

async function serializarArchivo(
  archivo: File | null,
): Promise<ArchivoGuardado | null> {
  if (!archivo) return null
  return {
    name: archivo.name,
    type: archivo.type || 'application/octet-stream',
    bytes: await archivo.arrayBuffer(),
  }
}

function archivoDesdeGuardado(guardado: ArchivoGuardado | null): File | null {
  if (!guardado) return null
  return new File([guardado.bytes], guardado.name, {
    type: guardado.type || 'application/octet-stream',
  })
}

function clonarEstilo(estilo: EstiloFuente): EstiloFuente {
  return { ...estilo }
}

function leerEscalas(origen: EscalasGuardadas): {
  escalaAncho: number
  escalaAlto: number
} {
  if (
    typeof origen.escalaAncho === 'number' &&
    typeof origen.escalaAlto === 'number'
  ) {
    return { escalaAncho: origen.escalaAncho, escalaAlto: origen.escalaAlto }
  }
  const legacy = typeof origen.escala === 'number' ? origen.escala : 100
  return { escalaAncho: legacy, escalaAlto: legacy }
}

export async function serializarFormulario(
  datos: DatosFormulario,
): Promise<DatosFormularioGuardado> {
  return {
    version: 1,
    fecha: datos.fecha,
    titulo: datos.titulo,
    resumen: datos.resumen,
    adjuntoResumen: await serializarArchivo(datos.adjuntoResumen),
    escalaResumenAncho: datos.escalaResumenAncho,
    escalaResumenAlto: datos.escalaResumenAlto,
    nuevaPaginaAntesResumen: datos.nuevaPaginaAntesResumen,
    comprobantes: await Promise.all(
      datos.comprobantes.map(async (bloque) => ({
        id: bloque.id,
        etiqueta: bloque.etiqueta,
        texto: bloque.texto,
        escalaAncho: bloque.escalaAncho,
        escalaAlto: bloque.escalaAlto,
        nuevaPaginaAntes: bloque.nuevaPaginaAntes,
        estilo: clonarEstilo(bloque.estilo),
        adjunto: await serializarArchivo(bloque.adjunto),
      })),
    ),
    facturaciones: await Promise.all(
      datos.facturaciones.map(async (bloque) => ({
        id: bloque.id,
        etiqueta: bloque.etiqueta,
        texto: bloque.texto,
        escalaAncho: bloque.escalaAncho,
        escalaAlto: bloque.escalaAlto,
        nuevaPaginaAntes: bloque.nuevaPaginaAntes,
        estilo: clonarEstilo(bloque.estilo),
        adjunto: await serializarArchivo(bloque.adjunto),
      })),
    ),
    textoSinFacturacion: datos.textoSinFacturacion,
    estadosCuenta: await Promise.all(
      datos.estadosCuenta.map(async (bloque) => ({
        id: bloque.id,
        texto: bloque.texto,
        detalle: bloque.detalle,
        escalaAncho: bloque.escalaAncho,
        escalaAlto: bloque.escalaAlto,
        nuevaPaginaAntes: bloque.nuevaPaginaAntes,
        estilo: clonarEstilo(bloque.estilo),
        estiloDetalle: clonarEstilo(bloque.estiloDetalle),
        adjunto: await serializarArchivo(bloque.adjunto),
      })),
    ),
    estilos: {
      fecha: clonarEstilo(datos.estilos.fecha),
      titulo: clonarEstilo(datos.estilos.titulo),
      resumen: clonarEstilo(datos.estilos.resumen),
      sinFacturacion: clonarEstilo(datos.estilos.sinFacturacion),
    },
  }
}

export function deserializarFormulario(
  guardado: DatosFormularioGuardado,
): DatosFormulario {
  const comprobantes =
    guardado.comprobantes.length > 0
      ? guardado.comprobantes.map((bloque) => ({
          id: bloque.id,
          etiqueta: bloque.etiqueta,
          texto: bloque.texto,
          ...leerEscalas(bloque),
          nuevaPaginaAntes: Boolean(bloque.nuevaPaginaAntes),
          estilo: clonarEstilo(bloque.estilo),
          adjunto: archivoDesdeGuardado(bloque.adjunto),
        }))
      : structuredClone(formularioInicial.comprobantes)

  const facturaciones =
    guardado.facturaciones.length > 0
      ? guardado.facturaciones.map((bloque) => ({
          id: bloque.id,
          etiqueta: bloque.etiqueta,
          texto: bloque.texto,
          ...leerEscalas(bloque),
          nuevaPaginaAntes: Boolean(bloque.nuevaPaginaAntes),
          estilo: clonarEstilo(bloque.estilo),
          adjunto: archivoDesdeGuardado(bloque.adjunto),
        }))
      : structuredClone(formularioInicial.facturaciones)

  const estadosCuenta =
    guardado.estadosCuenta.length > 0
      ? guardado.estadosCuenta.map((bloque) => ({
          id: bloque.id,
          texto: bloque.texto,
          detalle: bloque.detalle,
          ...leerEscalas(bloque),
          nuevaPaginaAntes: Boolean(bloque.nuevaPaginaAntes),
          estilo: clonarEstilo(bloque.estilo),
          estiloDetalle: clonarEstilo(bloque.estiloDetalle),
          adjunto: archivoDesdeGuardado(bloque.adjunto),
        }))
      : [crearBloqueEstadoCuenta()]

  return {
    fecha: guardado.fecha,
    titulo: guardado.titulo,
    resumen: guardado.resumen,
    adjuntoResumen: archivoDesdeGuardado(guardado.adjuntoResumen),
    escalaResumenAncho: guardado.escalaResumenAncho ?? 100,
    escalaResumenAlto: guardado.escalaResumenAlto ?? 100,
    nuevaPaginaAntesResumen: Boolean(guardado.nuevaPaginaAntesResumen),
    comprobantes:
      comprobantes.length > 0
        ? comprobantes
        : [crearBloqueAdjunto(formularioInicial.comprobantes[0]!.etiqueta)],
    facturaciones:
      facturaciones.length > 0
        ? facturaciones
        : [crearBloqueAdjunto(formularioInicial.facturaciones[0]!.etiqueta)],
    textoSinFacturacion: guardado.textoSinFacturacion,
    estadosCuenta,
    estilos: {
      fecha: clonarEstilo(guardado.estilos.fecha),
      titulo: clonarEstilo(guardado.estilos.titulo),
      resumen: clonarEstilo(guardado.estilos.resumen),
      sinFacturacion: clonarEstilo(guardado.estilos.sinFacturacion),
    },
  }
}
