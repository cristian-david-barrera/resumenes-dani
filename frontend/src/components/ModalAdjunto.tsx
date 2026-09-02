import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'

type Props = {
  abierto: boolean
  archivoActual: File | null
  onCerrar: () => void
  onConfirmar: (archivo: File | null) => void
}

function esArchivoValido(archivo: File): boolean {
  return (
    archivo.type.startsWith('image/') ||
    archivo.type === 'application/pdf' ||
    archivo.name.toLowerCase().endsWith('.pdf')
  )
}

export function ModalAdjunto({
  abierto,
  archivoActual,
  onCerrar,
  onConfirmar,
}: Props) {
  const inputId = useId()
  const zonaRef = useRef<HTMLDivElement>(null)
  const [archivo, setArchivo] = useState<File | null>(archivoActual)
  const [arrastrando, setArrastrando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setArchivo(archivoActual)
    setMensaje(null)
    setArrastrando(false)
  }, [abierto, archivoActual])

  useEffect(() => {
    if (!archivo || !archivo.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(archivo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  useEffect(() => {
    if (!abierto) return

    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }

    async function onPaste(evento: ClipboardEvent) {
      const items = evento.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          evento.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue

          const extension = blob.type.split('/')[1] || 'png'
          const pegado = new File(
            [blob],
            `captura-${Date.now()}.${extension}`,
            { type: blob.type },
          )
          setArchivo(pegado)
          setMensaje('Captura pegada correctamente')
          return
        }
      }

      const files = evento.clipboardData?.files
      if (files && files.length > 0) {
        const candidato = files[0]
        if (candidato && esArchivoValido(candidato)) {
          evento.preventDefault()
          setArchivo(candidato)
          setMensaje('Archivo pegado correctamente')
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    // Enfocar la zona para que pegar sea más intuitivo
    zonaRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('paste', onPaste)
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  function tomarArchivo(candidato: File | null | undefined) {
    if (!candidato) return
    if (!esArchivoValido(candidato)) {
      setMensaje('Solo se permiten imágenes o PDF')
      return
    }
    setArchivo(candidato)
    setMensaje(null)
  }

  function onFileChange(evento: ChangeEvent<HTMLInputElement>) {
    tomarArchivo(evento.target.files?.[0])
    evento.target.value = ''
  }

  function onDrop(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault()
    setArrastrando(false)
    tomarArchivo(evento.dataTransfer.files?.[0])
  }

  return (
    <div
      className="modal-overlay"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        className="modal-adjunto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-adjunto-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-adjunto-cabecera">
          <h2 id="modal-adjunto-titulo">Cargar archivo o captura</h2>
          <button type="button" className="btn-cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        <div
          ref={zonaRef}
          className={`zona-carga${arrastrando ? ' arrastrando' : ''}`}
          tabIndex={0}
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
            Arrastrá un archivo acá, pegá una captura (Ctrl+V) o elegí desde tu
            equipo
          </p>
          <p className="zona-carga-ayuda">Imágenes o PDF</p>

          <label htmlFor={inputId} className="btn ghost btn-elegir">
            Elegir archivo
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={onFileChange}
            hidden
          />
        </div>

        {mensaje ? <p className="modal-mensaje">{mensaje}</p> : null}

        {archivo ? (
          <div className="adjunto-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa del adjunto" />
            ) : (
              <p className="adjunto-preview-nombre">{archivo.name}</p>
            )}
            <div className="adjunto-preview-meta">
              <strong>{archivo.name}</strong>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setArchivo(null)
                  setMensaje(null)
                }}
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <p className="adjunto-vacio">Todavía no hay archivo seleccionado</p>
        )}

        <div className="modal-acciones">
          <button type="button" className="btn ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => onConfirmar(archivo)}
          >
            Usar archivo
          </button>
        </div>
      </div>
    </div>
  )
}
