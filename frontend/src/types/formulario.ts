export type FamiliaFuente =
  | 'helvetica'
  | 'times'
  | 'courier'
  | 'roboto'
  | 'opensans'
  | 'montserrat'
  | 'merriweather'
  | 'calibri'
  | 'verdana'

export type EstiloFuente = {
  familia: FamiliaFuente
  tamanio: number
  color: string
  negrita: boolean
  cursiva: boolean
}

/** Bloque reutilizable: texto + archivo (comprobantes, facturación, etc.). */
export type BloqueAdjunto = {
  id: string
  etiqueta: string
  texto: string
  adjunto: File | null
  /** Porcentaje de tamaño del adjunto en el PDF (30-100). */
  escala: number
  estilo: EstiloFuente
}

/** Estado de cuenta: texto + detalle (sin título en PDF) + adjunto. */
export type BloqueEstadoCuenta = {
  id: string
  texto: string
  detalle: string
  adjunto: File | null
  escala: number
  estilo: EstiloFuente
  estiloDetalle: EstiloFuente
}

/** @deprecated alias por compatibilidad interna */
export type Comprobante = BloqueAdjunto

export type DatosFormulario = {
  fecha: string
  titulo: string
  resumen: string
  adjuntoResumen: File | null
  comprobantes: BloqueAdjunto[]
  facturaciones: BloqueAdjunto[]
  /**
   * Texto que aparece en el PDF cuando hay facturación escrita
   * pero no se adjuntó archivo/imagen.
   */
  textoSinFacturacion: string
  estadosCuenta: BloqueEstadoCuenta[]
  estilos: {
    fecha: EstiloFuente
    titulo: EstiloFuente
    resumen: EstiloFuente
    sinFacturacion: EstiloFuente
  }
}

export const estiloFuenteInicial: EstiloFuente = {
  familia: 'helvetica',
  tamanio: 12,
  color: '#000000',
  negrita: false,
  cursiva: false,
}

export const ETIQUETA_PAGO_ARCA = 'COMPROBANTE DE PAGO'
export const ETIQUETA_FACTURACION = 'FACTURACION REALIZADA'
export const ETIQUETA_ESTADO_CUENTA = 'ESTADO DE CUENTA CORRIENTE:'
/** Clave de localStorage para el estilo del detalle (no es etiqueta de PDF). */
export const CLAVE_ESTILO_DETALLE_ESTADO = 'DETALLE ESTADO CUENTA'

export function crearBloqueAdjunto(
  etiqueta: string,
  id: string = crypto.randomUUID(),
): BloqueAdjunto {
  return {
    id,
    etiqueta,
    texto: '',
    adjunto: null,
    escala: 100,
    estilo: { ...estiloFuenteInicial, tamanio: 12, negrita: true },
  }
}

export function crearBloqueEstadoCuenta(
  id: string = crypto.randomUUID(),
): BloqueEstadoCuenta {
  return {
    id,
    texto: '',
    detalle: '',
    adjunto: null,
    escala: 100,
    estilo: { ...estiloFuenteInicial, tamanio: 12, negrita: true },
    estiloDetalle: { ...estiloFuenteInicial, tamanio: 11 },
  }
}

/** @deprecated usar crearBloqueAdjunto */
export function crearComprobante(
  tipo: string,
  id: string = crypto.randomUUID(),
): BloqueAdjunto {
  return crearBloqueAdjunto(
    tipo.startsWith('COMPROBANTE') ? tipo : `COMPROBANTE ${tipo}`.trim(),
    id,
  )
}

export const formularioInicial: DatosFormulario = {
  fecha: '',
  titulo: 'Mi monotributo',
  resumen: '',
  adjuntoResumen: null,
  comprobantes: [crearBloqueAdjunto(ETIQUETA_PAGO_ARCA, 'pago-arca')],
  facturaciones: [crearBloqueAdjunto(ETIQUETA_FACTURACION, 'facturacion-1')],
  textoSinFacturacion: 'SIN FACTURACION',
  estadosCuenta: [crearBloqueEstadoCuenta('estado-cuenta-1')],
  estilos: {
    fecha: { ...estiloFuenteInicial, tamanio: 11 },
    titulo: { ...estiloFuenteInicial, tamanio: 18, negrita: true },
    resumen: { ...estiloFuenteInicial, tamanio: 12, negrita: true },
    sinFacturacion: {
      ...estiloFuenteInicial,
      familia: 'verdana',
      tamanio: 14,
      negrita: true,
    },
  },
}

export const familiasFuente: { value: FamiliaFuente; label: string }[] = [
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'times', label: 'Times' },
  { value: 'courier', label: 'Courier' },
  { value: 'calibri', label: 'Calibri' },
  { value: 'verdana', label: 'Verdana' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'opensans', label: 'Open Sans' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'merriweather', label: 'Merriweather' },
]

export function etiquetaComprobante(etiqueta: string): string {
  return etiqueta
}

export function textoBloquePdf(etiqueta: string, valor: string): string {
  const detalle = valor.trim()
  return detalle ? `${etiqueta} ${detalle}` : etiqueta
}

/** Cómo se imprime cada campo en el PDF final (no en el formulario). */
export const configPdf = {
  fecha: {
    ubicacion: 'arriba a la derecha',
    mostrarEtiqueta: false,
  },
  titulo: {
    ubicacion: 'centrado',
    mostrarEtiqueta: false,
  },
  resumen: {
    ubicacion: 'a la izquierda',
    etiqueta: 'RESUMEN',
    mostrarEtiqueta: true,
  },
  adjuntoResumen: {
    ubicacion: 'debajo de RESUMEN',
    mostrarEtiqueta: false,
  },
  comprobantes: {
    ubicacion: 'a la izquierda',
    adjuntoCentrado: true,
    escalaIndividual: true,
  },
  facturaciones: {
    ubicacion: 'a la izquierda',
    adjuntoCentrado: true,
    escalaIndividual: true,
  },
  textoSinFacturacion: {
    ubicacion: 'a la izquierda, debajo de FACTURACION REALIZADA si no hay adjunto',
    valorPorDefecto: 'SIN FACTURACION',
  },
  estadosCuenta: {
    ubicacion: 'a la izquierda',
    etiqueta: 'ESTADO DE CUENTA CORRIENTE:',
    detalleSinTituloEnPdf: true,
    repetible: true,
  },
} as const
