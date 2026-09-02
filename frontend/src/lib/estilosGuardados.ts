import {
  CLAVE_ESTILO_DETALLE_ESTADO,
  ETIQUETA_ESTADO_CUENTA,
  formularioInicial,
  type BloqueAdjunto,
  type BloqueEstadoCuenta,
  type DatosFormulario,
  type EstiloFuente,
  type FamiliaFuente,
} from '../types/formulario'

const STORAGE_KEY = 'daniela.estilosFuente'
const STORAGE_BLOQUES_KEY = 'daniela.estilosBloques'

const familiasValidas: FamiliaFuente[] = [
  'helvetica',
  'times',
  'courier',
  'calibri',
  'verdana',
  'roboto',
  'opensans',
  'montserrat',
  'merriweather',
]

function esEstiloValido(valor: unknown): valor is EstiloFuente {
  if (!valor || typeof valor !== 'object') return false
  const estilo = valor as Partial<EstiloFuente>
  return (
    typeof estilo.familia === 'string' &&
    familiasValidas.includes(estilo.familia as FamiliaFuente) &&
    typeof estilo.tamanio === 'number' &&
    Number.isFinite(estilo.tamanio) &&
    typeof estilo.color === 'string' &&
    typeof estilo.negrita === 'boolean' &&
    typeof estilo.cursiva === 'boolean'
  )
}

export function cargarEstilosGuardados(): DatosFormulario['estilos'] {
  const base = structuredClone(formularioInicial.estilos)

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base

    const parsed = JSON.parse(raw) as Partial<DatosFormulario['estilos']>
    const campos: (keyof DatosFormulario['estilos'])[] = [
      'fecha',
      'titulo',
      'resumen',
      'sinFacturacion',
    ]

    for (const campo of campos) {
      if (esEstiloValido(parsed[campo])) {
        base[campo] = parsed[campo]
      }
    }

    return base
  } catch {
    return base
  }
}

export function guardarEstilos(estilos: DatosFormulario['estilos']): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estilos))
}

const STORAGE_TEXTO_SIN_FACTURACION = 'daniela.textoSinFacturacion'

export function cargarTextoSinFacturacion(): string {
  try {
    const raw = localStorage.getItem(STORAGE_TEXTO_SIN_FACTURACION)
    if (raw == null) {
      return formularioInicial.textoSinFacturacion
    }
    return raw
  } catch {
    return formularioInicial.textoSinFacturacion
  }
}

export function guardarTextoSinFacturacion(texto: string): void {
  localStorage.setItem(STORAGE_TEXTO_SIN_FACTURACION, texto)
}

export function cargarEstilosBloques(): Record<string, EstiloFuente> {
  try {
    const raw =
      localStorage.getItem(STORAGE_BLOQUES_KEY) ??
      localStorage.getItem('daniela.estilosComprobantes')
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, EstiloFuente> = {}
    for (const [clave, estilo] of Object.entries(parsed)) {
      if (esEstiloValido(estilo)) result[clave] = estilo
    }
    return result
  } catch {
    return {}
  }
}

/** @deprecated */
export function cargarEstilosComprobantes(): Record<string, EstiloFuente> {
  return cargarEstilosBloques()
}

export function aplicarEstilosEstadosCuenta(
  bloques: BloqueEstadoCuenta[],
  estilosGuardados: Record<string, EstiloFuente>,
): BloqueEstadoCuenta[] {
  return bloques.map((item) => ({
    ...item,
    estilo: estilosGuardados[ETIQUETA_ESTADO_CUENTA]
      ? { ...estilosGuardados[ETIQUETA_ESTADO_CUENTA]! }
      : item.estilo,
    estiloDetalle: estilosGuardados[CLAVE_ESTILO_DETALLE_ESTADO]
      ? { ...estilosGuardados[CLAVE_ESTILO_DETALLE_ESTADO]! }
      : item.estiloDetalle,
  }))
}

export function guardarEstilosBloques(
  bloques: BloqueAdjunto[],
  estadosCuenta: BloqueEstadoCuenta[] = [],
): void {
  const mapa: Record<string, EstiloFuente> = {}
  for (const item of bloques) {
    mapa[item.etiqueta] = item.estilo
  }
  const ultimoEstado = estadosCuenta[estadosCuenta.length - 1]
  if (ultimoEstado) {
    mapa[ETIQUETA_ESTADO_CUENTA] = ultimoEstado.estilo
    mapa[CLAVE_ESTILO_DETALLE_ESTADO] = ultimoEstado.estiloDetalle
  }
  localStorage.setItem(STORAGE_BLOQUES_KEY, JSON.stringify(mapa))
}

/** @deprecated */
export function guardarEstilosComprobantes(bloques: BloqueAdjunto[]): void {
  guardarEstilosBloques(bloques)
}
