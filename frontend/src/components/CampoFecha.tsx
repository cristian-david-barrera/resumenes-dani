import { useId } from 'react'
import { cssFamilyDeFuente } from '../lib/fuentesPdf'
import { familiasFuente, type EstiloFuente } from '../types/formulario'

type Props = {
  etiqueta: string
  valor: string
  estilo: EstiloFuente
  placeholder?: string
  panelAbierto: boolean
  onToggleFuente: () => void
  onValorChange: (valor: string) => void
  onEstiloChange: (estilo: EstiloFuente) => void
}

/** Formatea dígitos a dd/mm/aaaa mientras se escribe. */
export function formatearFechaTyped(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

function fechaAIso(valor: string): string {
  const match = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, dd, mm, yyyy] = match
  const fecha = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (
    fecha.getFullYear() !== Number(yyyy) ||
    fecha.getMonth() !== Number(mm) - 1 ||
    fecha.getDate() !== Number(dd)
  ) {
    return ''
  }
  return `${yyyy}-${mm}-${dd}`
}

function isoAFecha(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

export function CampoFecha({
  etiqueta,
  valor,
  estilo,
  placeholder = 'dd/mm/aaaa',
  panelAbierto,
  onToggleFuente,
  onValorChange,
  onEstiloChange,
}: Props) {
  const dateId = useId()

  function actualizarEstilo<K extends keyof EstiloFuente>(
    campo: K,
    valorCampo: EstiloFuente[K],
  ) {
    onEstiloChange({ ...estilo, [campo]: valorCampo })
  }

  const estiloTexto = {
    fontFamily: cssFamilyDeFuente(estilo.familia),
    fontSize: `${Math.max(14, Math.min(estilo.tamanio, 22))}px`,
    color: estilo.color,
    fontWeight: estilo.negrita ? 700 : 500,
    fontStyle: estilo.cursiva ? 'italic' : 'normal',
  } as const

  const valorIso = fechaAIso(valor)

  return (
    <div className="campo-fuente">
      <div className="campo-fuente-cabecera">
        <span>{etiqueta}</span>
        <button
          type="button"
          className={`btn-fuente${panelAbierto ? ' active' : ''}`}
          onClick={onToggleFuente}
        >
          Fuente
        </button>
      </div>

      <div className="campo-fecha-fila">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          maxLength={10}
          onChange={(e) => onValorChange(formatearFechaTyped(e.target.value))}
          placeholder={placeholder}
          style={estiloTexto}
          aria-describedby={`${dateId}-ayuda`}
        />
        <input
          id={dateId}
          type="date"
          className="campo-fecha-nativo"
          value={valorIso}
          onChange={(e) => {
            const iso = e.target.value
            onValorChange(iso ? isoAFecha(iso) : '')
          }}
          aria-label="Elegir fecha en el calendario"
          title="Elegir fecha en el calendario"
        />
      </div>
      <p id={`${dateId}-ayuda`} className="campo-ayuda">
        Escribí dd/mm/aaaa (las barras se ponen solas) o elegí en el calendario.
      </p>

      {panelAbierto ? (
        <div className="panel-fuente">
          <label>
            Tipo de letra
            <select
              value={estilo.familia}
              onChange={(e) =>
                actualizarEstilo(
                  'familia',
                  e.target.value as EstiloFuente['familia'],
                )
              }
            >
              {familiasFuente.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tamaño
            <input
              type="number"
              min={8}
              max={48}
              value={estilo.tamanio}
              onChange={(e) =>
                actualizarEstilo('tamanio', Number(e.target.value) || 12)
              }
            />
          </label>

          <label>
            Color
            <input
              type="color"
              value={estilo.color}
              onChange={(e) => actualizarEstilo('color', e.target.value)}
            />
          </label>

          <div className="panel-fuente-checks">
            <label className="check">
              <input
                type="checkbox"
                checked={estilo.negrita}
                onChange={(e) => actualizarEstilo('negrita', e.target.checked)}
              />
              Negrita
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={estilo.cursiva}
                onChange={(e) => actualizarEstilo('cursiva', e.target.checked)}
              />
              Cursiva
            </label>
          </div>
        </div>
      ) : null}
    </div>
  )
}
