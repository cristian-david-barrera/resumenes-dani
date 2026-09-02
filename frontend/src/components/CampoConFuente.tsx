import { cssFamilyDeFuente } from '../lib/fuentesPdf'
import { familiasFuente, type EstiloFuente } from '../types/formulario'

type Props = {
  etiqueta: string
  valor: string
  estilo: EstiloFuente
  placeholder?: string
  multilinea?: boolean
  filas?: number
  panelAbierto: boolean
  onToggleFuente: () => void
  onValorChange: (valor: string) => void
  onEstiloChange: (estilo: EstiloFuente) => void
}

export function CampoConFuente({
  etiqueta,
  valor,
  estilo,
  placeholder,
  multilinea = false,
  filas = 4,
  panelAbierto,
  onToggleFuente,
  onValorChange,
  onEstiloChange,
}: Props) {
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

      {multilinea ? (
        <textarea
          value={valor}
          rows={filas}
          onChange={(e) => onValorChange(e.target.value)}
          placeholder={placeholder}
          style={estiloTexto}
        />
      ) : (
        <input
          type="text"
          value={valor}
          onChange={(e) => onValorChange(e.target.value)}
          placeholder={placeholder}
          style={estiloTexto}
        />
      )}

      {panelAbierto ? (
        <div className="panel-fuente">
          <label>
            Tipo de letra
            <select
              value={estilo.familia}
              onChange={(e) =>
                actualizarEstilo('familia', e.target.value as EstiloFuente['familia'])
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
