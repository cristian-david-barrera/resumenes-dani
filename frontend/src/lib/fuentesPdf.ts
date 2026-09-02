import type { jsPDF } from 'jspdf'
import type { FamiliaFuente } from '../types/formulario'

type Variante = 'normal' | 'bold' | 'italic' | 'bolditalic'

type FuenteDefinicion = {
  label: string
  nativa?: boolean
  cssFamily: string
  archivos?: Partial<Record<Variante, string>>
}

export const definicionFuentes: Record<FamiliaFuente, FuenteDefinicion> = {
  helvetica: {
    label: 'Helvetica',
    nativa: true,
    cssFamily: 'Helvetica, Arial, sans-serif',
  },
  times: {
    label: 'Times',
    nativa: true,
    cssFamily: '"Times New Roman", Times, serif',
  },
  courier: {
    label: 'Courier',
    nativa: true,
    cssFamily: '"Courier New", Courier, monospace',
  },
  calibri: {
    label: 'Calibri',
    cssFamily: 'Calibri, Candara, Segoe UI, sans-serif',
    archivos: {
      normal: '/fonts/Calibri-Regular.ttf',
      bold: '/fonts/Calibri-Bold.ttf',
      italic: '/fonts/Calibri-Italic.ttf',
      bolditalic: '/fonts/Calibri-BoldItalic.ttf',
    },
  },
  verdana: {
    label: 'Verdana',
    cssFamily: 'Verdana, Geneva, sans-serif',
    archivos: {
      normal: '/fonts/Verdana-Regular.ttf',
      bold: '/fonts/Verdana-Bold.ttf',
      italic: '/fonts/Verdana-Italic.ttf',
      bolditalic: '/fonts/Verdana-BoldItalic.ttf',
    },
  },
  roboto: {
    label: 'Roboto',
    cssFamily: 'Roboto, Helvetica, sans-serif',
    archivos: {
      normal: '/fonts/Roboto-Regular.ttf',
      bold: '/fonts/Roboto-Bold.ttf',
      italic: '/fonts/Roboto-Italic.ttf',
      bolditalic: '/fonts/Roboto-BoldItalic.ttf',
    },
  },
  opensans: {
    label: 'Open Sans',
    cssFamily: '"Open Sans", Helvetica, sans-serif',
    archivos: {
      normal: '/fonts/OpenSans-Regular.ttf',
      bold: '/fonts/OpenSans-Bold.ttf',
      italic: '/fonts/OpenSans-Italic.ttf',
      bolditalic: '/fonts/OpenSans-BoldItalic.ttf',
    },
  },
  montserrat: {
    label: 'Montserrat',
    cssFamily: 'Montserrat, Helvetica, sans-serif',
    archivos: {
      normal: '/fonts/Montserrat-Regular.ttf',
      bold: '/fonts/Montserrat-Bold.ttf',
      italic: '/fonts/Montserrat-Italic.ttf',
      bolditalic: '/fonts/Montserrat-BoldItalic.ttf',
    },
  },
  merriweather: {
    label: 'Merriweather',
    cssFamily: 'Merriweather, Georgia, serif',
    archivos: {
      normal: '/fonts/Merriweather-Regular.ttf',
      bold: '/fonts/Merriweather-Bold.ttf',
      italic: '/fonts/Merriweather-Italic.ttf',
      bolditalic: '/fonts/Merriweather-BoldItalic.ttf',
    },
  },
}

const fuentesCargadas = new Set<string>()

async function archivoABase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`No se pudo cargar la fuente: ${url}`)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function asegurarFuente(
  doc: jsPDF,
  familia: FamiliaFuente,
): Promise<void> {
  const def = definicionFuentes[familia]
  if (!def || def.nativa || !def.archivos) return

  const variantes = Object.entries(def.archivos) as [Variante, string][]
  for (const [variante, url] of variantes) {
    const clave = `${familia}:${variante}`
    if (fuentesCargadas.has(clave)) continue

    const base64 = await archivoABase64(url)
    const vfsName = `${familia}-${variante}.ttf`
    doc.addFileToVFS(vfsName, base64)
    doc.addFont(vfsName, familia, variante)
    fuentesCargadas.add(clave)
  }
}

export function cssFamilyDeFuente(familia: FamiliaFuente): string {
  return definicionFuentes[familia]?.cssFamily ?? 'Helvetica, sans-serif'
}
