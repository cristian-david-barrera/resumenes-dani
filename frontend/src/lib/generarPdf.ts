import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type {
  BloqueAdjunto,
  DatosFormulario,
  EstiloFuente,
  FamiliaFuente,
} from '../types/formulario'
import { textoBloquePdf } from '../types/formulario'
import type { Plantilla } from '../types/plantilla'
import { definicionFuentes } from './fuentesPdf'
import { rasterizarPdfAPngs } from './rasterizarPdf'

type Variante = 'normal' | 'bold' | 'italic' | 'bolditalic'

function hexARgb(hex: string): { r: number; g: number; b: number } {
  const limpio = hex.replace('#', '')
  const full =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio
  const num = Number.parseInt(full, 16)
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  }
}

function varianteDeEstilo(estilo: EstiloFuente): Variante {
  if (estilo.negrita && estilo.cursiva) return 'bolditalic'
  if (estilo.negrita) return 'bold'
  if (estilo.cursiva) return 'italic'
  return 'normal'
}

async function cargarBytesFuente(
  familia: FamiliaFuente,
  variante: Variante,
): Promise<ArrayBuffer | null> {
  const def = definicionFuentes[familia]
  const url = def.archivos?.[variante] ?? def.archivos?.normal
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`No se pudo cargar la fuente ${familia}`)
  }
  return response.arrayBuffer()
}

async function obtenerFuente(
  pdfDoc: PDFDocument,
  estilo: EstiloFuente,
  cache: Map<string, PDFFont>,
): Promise<PDFFont> {
  const variante = varianteDeEstilo(estilo)
  const clave = `${estilo.familia}:${variante}`
  const cached = cache.get(clave)
  if (cached) return cached

  const def = definicionFuentes[estilo.familia]
  if (def.nativa) {
    const standard =
      estilo.familia === 'times'
        ? {
            normal: StandardFonts.TimesRoman,
            bold: StandardFonts.TimesRomanBold,
            italic: StandardFonts.TimesRomanItalic,
            bolditalic: StandardFonts.TimesRomanBoldItalic,
          }[variante]
        : estilo.familia === 'courier'
          ? {
              normal: StandardFonts.Courier,
              bold: StandardFonts.CourierBold,
              italic: StandardFonts.CourierOblique,
              bolditalic: StandardFonts.CourierBoldOblique,
            }[variante]
          : {
              normal: StandardFonts.Helvetica,
              bold: StandardFonts.HelveticaBold,
              italic: StandardFonts.HelveticaOblique,
              bolditalic: StandardFonts.HelveticaBoldOblique,
            }[variante]

    const font = await pdfDoc.embedFont(standard)
    cache.set(clave, font)
    return font
  }

  const bytes = await cargarBytesFuente(estilo.familia, variante)
  if (!bytes) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    cache.set(clave, font)
    return font
  }

  const font = await pdfDoc.embedFont(bytes)
  cache.set(clave, font)
  return font
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

function esArchivoPdf(archivo: File): boolean {
  return (
    archivo.type === 'application/pdf' ||
    archivo.name.toLowerCase().endsWith('.pdf')
  )
}

function fraccionEscala(escalaPct: number): number {
  return Math.min(2, Math.max(0.3, escalaPct / 100))
}

/** Alto máximo al 100% (antes 120 mm): casi el cuerpo útil de la hoja. */
const ALTO_MAX_ADJUNTO_MM = 200

function medirContenidoAdjunto(
  origWidth: number,
  origHeight: number,
  pageWidth: number,
  marginLeft: number,
  marginRight: number,
  escalaAnchoPct: number,
  escalaAltoPct: number,
  maxHeightBase: number = mmToPt(ALTO_MAX_ADJUNTO_MM),
): { width: number; height: number } {
  // Al 100% usa todo el ancho útil; el alto llega hasta ALTO_MAX_ADJUNTO_MM.
  const baseMaxW = pageWidth - marginLeft - marginRight
  const baseMaxH = Math.max(mmToPt(20), maxHeightBase)
  const ratio = origWidth / Math.max(origHeight, 1)
  let width = baseMaxW
  let height = width / ratio

  if (height > baseMaxH) {
    height = baseMaxH
    width = height * ratio
  }

  // Escalas independientes: permiten achicar ancho y alto por separado.
  width *= fraccionEscala(escalaAnchoPct)
  height *= fraccionEscala(escalaAltoPct)

  return { width, height }
}

function medirImagen(
  imagen: PDFImage,
  pageWidth: number,
  marginLeft: number,
  marginRight: number,
  escalaAnchoPct: number,
  escalaAltoPct: number,
  maxHeightBase?: number,
): { width: number; height: number } {
  return medirContenidoAdjunto(
    imagen.width,
    imagen.height,
    pageWidth,
    marginLeft,
    marginRight,
    escalaAnchoPct,
    escalaAltoPct,
    maxHeightBase,
  )
}

async function crearDocumentoBase(plantilla?: Plantilla | null): Promise<{
  pdfDoc: PDFDocument
  page: PDFPage
  pageWidth: number
  pageHeight: number
  fondoImagen: PDFImage | null
  esPlantillaPdf: boolean
}> {
  if (plantilla?.mimeType === 'application/pdf') {
    const pdfDoc = await PDFDocument.load(plantilla.bytes)
    pdfDoc.registerFontkit(fontkit)
    const page = pdfDoc.getPages()[0]
    if (!page) {
      throw new Error('La plantilla PDF no tiene páginas')
    }
    const { width, height } = page.getSize()
    return {
      pdfDoc,
      page,
      pageWidth: width,
      pageHeight: height,
      fondoImagen: null,
      esPlantillaPdf: true,
    }
  }

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const page = pdfDoc.addPage([mmToPt(210), mmToPt(297)])
  const { width, height } = page.getSize()
  let fondoImagen: PDFImage | null = null

  if (plantilla?.mimeType.startsWith('image/')) {
    const bytes = new Uint8Array(plantilla.bytes)
    fondoImagen = plantilla.mimeType.includes('png')
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes)

    page.drawImage(fondoImagen, {
      x: 0,
      y: 0,
      width,
      height,
    })
  }

  return {
    pdfDoc,
    page,
    pageWidth: width,
    pageHeight: height,
    fondoImagen,
    esPlantillaPdf: false,
  }
}

export type PdfGenerado = {
  blob: Blob
  url: string
  nombreArchivo: string
}

export async function generarPdf(
  datos: DatosFormulario,
  plantilla?: Plantilla | null,
): Promise<PdfGenerado> {
  const base = await crearDocumentoBase(plantilla)
  const { pdfDoc, pageWidth, pageHeight, fondoImagen, esPlantillaPdf } = base
  let page = base.page
  const fontCache = new Map<string, PDFFont>()
  const marginLeft = plantilla ? mmToPt(34) : mmToPt(20)
  const marginRight = mmToPt(20)
  const marginTop = mmToPt(20)
  // Espacio inferior para no tapar la firma de la plantilla
  const marginBottom = plantilla ? mmToPt(48) : mmToPt(20)
  let yTop = marginTop

  async function nuevaPagina() {
    if (esPlantillaPdf) {
      const plantillaOriginal = await PDFDocument.load(plantilla!.bytes)
      const [copia] = await pdfDoc.copyPages(plantillaOriginal, [0])
      page = pdfDoc.addPage(copia)
    } else {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      if (fondoImagen) {
        page.drawImage(fondoImagen, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        })
      }
    }
    yTop = marginTop
  }

  function espacioDisponible() {
    return pageHeight - marginBottom - yTop
  }

  async function asegurarEspacio(alturaNecesaria: number) {
    if (alturaNecesaria <= espacioDisponible()) return
    // Si estamos casi al inicio, no hay página previa útil: se dibuja igual
    if (yTop <= marginTop + mmToPt(2)) return
    await nuevaPagina()
  }

  async function medirAlturaTexto(
    texto: string,
    estilo: EstiloFuente,
  ): Promise<number> {
    const font = await obtenerFuente(pdfDoc, estilo, fontCache)
    const maxWidth = pageWidth - marginLeft - marginRight
    const lineas = wrapText(texto, font, estilo.tamanio, maxWidth)
    return lineas.length * estilo.tamanio * 1.25
  }

  type ImagenLista = {
    imagen: PDFImage
    width: number
    height: number
  }

  async function prepararImagenesAdjunto(
    adjunto: File | null,
    escalaAncho: number,
    escalaAlto: number,
  ): Promise<ImagenLista[]> {
    if (!adjunto) return []

    if (adjunto.type.startsWith('image/')) {
      const bytes = new Uint8Array(await adjunto.arrayBuffer())
      const imagen = adjunto.type.includes('png')
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      const dims = medirImagen(
        imagen,
        pageWidth,
        marginLeft,
        marginRight,
        escalaAncho,
        escalaAlto,
      )
      return [{ imagen, ...dims }]
    }

    if (esArchivoPdf(adjunto)) {
      try {
        const pngs = await rasterizarPdfAPngs(await adjunto.arrayBuffer())
        const listas: ImagenLista[] = []
        for (const png of pngs) {
          const imagen = await pdfDoc.embedPng(png)
          const dims = medirImagen(
            imagen,
            pageWidth,
            marginLeft,
            marginRight,
            escalaAncho,
            escalaAlto,
          )
          listas.push({ imagen, ...dims })
        }
        return listas
      } catch {
        return []
      }
    }

    return []
  }

  async function dibujarTexto(
    texto: string,
    estilo: EstiloFuente,
    opciones: {
      align?: 'left' | 'center' | 'right'
      maxWidth?: number
      /** Si true, no abre página nueva (el bloque ya reservó espacio). */
      mantenerJunto?: boolean
    },
  ) {
    const font = await obtenerFuente(pdfDoc, estilo, fontCache)
    const size = estilo.tamanio
    const color = hexARgb(estilo.color)
    const maxWidth = opciones.maxWidth ?? pageWidth - marginLeft - marginRight
    const lineas = wrapText(texto, font, size, maxWidth)
    const lineHeight = size * 1.25
    const altura = lineas.length * lineHeight

    if (!opciones.mantenerJunto) {
      await asegurarEspacio(altura)
    }

    for (const linea of lineas) {
      if (
        !opciones.mantenerJunto &&
        lineHeight > espacioDisponible() &&
        yTop > marginTop + mmToPt(2)
      ) {
        await nuevaPagina()
      }

      const textWidth = font.widthOfTextAtSize(linea, size)
      let x = marginLeft
      if (opciones.align === 'center') x = (pageWidth - textWidth) / 2
      if (opciones.align === 'right') x = pageWidth - marginRight - textWidth

      page.drawText(linea, {
        x,
        y: pageHeight - yTop - size,
        size,
        font,
        color: rgb(color.r, color.g, color.b),
      })
      yTop += lineHeight
    }
  }

  async function dibujarImagenLista(
    item: ImagenLista,
    opciones?: {
      centrado?: boolean
      permitirSalto?: boolean
      /** Si true, al 100% el adjunto usa todo el alto y ancho útiles de la página. */
      llenarPagina?: boolean
      escalaAncho?: number
      escalaAlto?: number
    },
  ) {
    const permitirSalto = opciones?.permitirSalto !== false
    const escalaAncho = opciones?.escalaAncho ?? 100
    const escalaAlto = opciones?.escalaAlto ?? 100
    let imgWidth = item.width
    let imgHeight = item.height

    if (opciones?.llenarPagina) {
      const disponible = Math.max(mmToPt(20), espacioDisponible() - mmToPt(4))
      const dims = medirImagen(
        item.imagen,
        pageWidth,
        marginLeft,
        marginRight,
        escalaAncho,
        escalaAlto,
        disponible,
      )
      imgWidth = dims.width
      imgHeight = dims.height
    } else {
      if (permitirSalto) {
        await asegurarEspacio(imgHeight + mmToPt(6))
      }

      // Solo achica si ni en página vacía entra (evita desbordar márgenes).
      const disponible = espacioDisponible() - mmToPt(6)
      if (
        imgHeight > disponible &&
        disponible > mmToPt(20) &&
        yTop <= marginTop + mmToPt(2)
      ) {
        const factor = disponible / imgHeight
        imgHeight *= factor
        imgWidth *= factor
      }
    }

    const xImg = opciones?.centrado
      ? (pageWidth - imgWidth) / 2
      : marginLeft
    const yImg = pageHeight - yTop - imgHeight

    page.drawImage(item.imagen, {
      x: xImg,
      y: Math.max(marginBottom, yImg),
      width: imgWidth,
      height: imgHeight,
    })
    yTop += imgHeight + mmToPt(6)
  }

  /**
   * Dibuja título(s) + contenido siguiente sin dejar el título solo al pie.
   * Si no entra el bloque (textos + primera imagen), salta de página antes.
   */
  async function dibujarSeccionConAdjunto(opciones: {
    textos: { texto: string; estilo: EstiloFuente; gapDespues?: number }[]
    adjunto: File | null
    estiloFallbackAdjunto: EstiloFuente
    centradoAdjunto?: boolean
    escalaAncho?: number
    escalaAlto?: number
    paddingSuperior?: number
    textoSinAdjunto?: string
    estiloSinAdjunto?: EstiloFuente
    /** El adjunto al 100% ocupa el resto de la página (ancho y alto útiles). */
    llenarPagina?: boolean
    /** Fuerza empezar esta sección en una página nueva. */
    forzarNuevaPagina?: boolean
  }) {
    const padding = opciones.paddingSuperior ?? mmToPt(8)
    const escalaAncho = opciones.escalaAncho ?? 100
    const escalaAlto = opciones.escalaAlto ?? 100
    const llenarPagina = Boolean(opciones.llenarPagina)

    if (
      opciones.forzarNuevaPagina &&
      yTop > marginTop + mmToPt(2)
    ) {
      await nuevaPagina()
    }

    const imagenes = await prepararImagenesAdjunto(
      opciones.adjunto,
      escalaAncho,
      escalaAlto,
    )

    let altura = padding
    for (const item of opciones.textos) {
      altura += await medirAlturaTexto(item.texto, item.estilo)
      altura += item.gapDespues ?? mmToPt(2)
    }

    if (imagenes.length > 0 && llenarPagina) {
      if (yTop > marginTop + mmToPt(2)) {
        await nuevaPagina()
      }
    } else if (imagenes.length > 0) {
      // Si no entra completo, salta de página (no achica).
      altura += imagenes[0]!.height + mmToPt(6)
    } else if (
      opciones.textoSinAdjunto?.trim() &&
      opciones.estiloSinAdjunto &&
      !opciones.adjunto
    ) {
      altura +=
        (await medirAlturaTexto(
          opciones.textoSinAdjunto.trim(),
          opciones.estiloSinAdjunto,
        )) + mmToPt(4)
    } else if (opciones.adjunto) {
      altura += mmToPt(14)
    }

    if (!(imagenes.length > 0 && llenarPagina)) {
      await asegurarEspacio(altura)
    }
    yTop += padding

    for (const item of opciones.textos) {
      await dibujarTexto(item.texto, item.estilo, {
        align: 'left',
        mantenerJunto: true,
      })
      yTop += item.gapDespues ?? mmToPt(2)
    }

    if (imagenes.length > 0) {
      await dibujarImagenLista(imagenes[0]!, {
        centrado: opciones.centradoAdjunto,
        permitirSalto: true,
        llenarPagina,
        escalaAncho,
        escalaAlto,
      })
      for (let i = 1; i < imagenes.length; i += 1) {
        if (llenarPagina) {
          await nuevaPagina()
        }
        await dibujarImagenLista(imagenes[i]!, {
          centrado: opciones.centradoAdjunto,
          permitirSalto: true,
          llenarPagina,
          escalaAncho,
          escalaAlto,
        })
      }
      return
    }

    if (
      opciones.textoSinAdjunto?.trim() &&
      opciones.estiloSinAdjunto &&
      !opciones.adjunto
    ) {
      await dibujarTexto(
        opciones.textoSinAdjunto.trim(),
        opciones.estiloSinAdjunto,
        { align: 'left', mantenerJunto: true },
      )
      yTop += mmToPt(4)
      return
    }

    if (opciones.adjunto) {
      await dibujarTexto(
        `Adjunto: ${opciones.adjunto.name}`,
        {
          ...opciones.estiloFallbackAdjunto,
          tamanio: 10,
          negrita: false,
          cursiva: true,
          familia: 'helvetica',
          color: '#000000',
        },
        {
          align: opciones.centradoAdjunto ? 'center' : 'left',
          mantenerJunto: true,
        },
      )
      yTop += mmToPt(4)
    }
  }

  async function dibujarBloques(
    bloques: BloqueAdjunto[],
    opciones?: {
      textoSinAdjunto?: string
      estiloSinAdjunto?: EstiloFuente
    },
  ) {
    for (const bloque of bloques) {
      const texto = textoBloquePdf(bloque.etiqueta, bloque.texto)
      const mostrarTextoSinAdjunto =
        Boolean(opciones?.textoSinAdjunto?.trim()) &&
        Boolean(bloque.texto.trim()) &&
        !bloque.adjunto

      await dibujarSeccionConAdjunto({
        textos: [{ texto, estilo: bloque.estilo }],
        adjunto: bloque.adjunto,
        estiloFallbackAdjunto: bloque.estilo,
        centradoAdjunto: true,
        escalaAncho: bloque.escalaAncho,
        escalaAlto: bloque.escalaAlto,
        llenarPagina: false,
        forzarNuevaPagina: bloque.nuevaPaginaAntes,
        textoSinAdjunto: mostrarTextoSinAdjunto
          ? opciones?.textoSinAdjunto
          : undefined,
        estiloSinAdjunto: mostrarTextoSinAdjunto
          ? opciones?.estiloSinAdjunto
          : undefined,
      })
    }
  }

  if (datos.fecha.trim()) {
    await dibujarTexto(datos.fecha.trim(), datos.estilos.fecha, {
      align: 'right',
    })
  }

  yTop += mmToPt(6)

  if (datos.titulo.trim()) {
    await dibujarTexto(datos.titulo.trim(), datos.estilos.titulo, {
      align: 'center',
    })
    yTop += mmToPt(16)
  }

  const textoResumen = datos.resumen.trim()
    ? `RESUMEN ${datos.resumen.trim()}`
    : 'RESUMEN'
  await dibujarSeccionConAdjunto({
    textos: [{ texto: textoResumen, estilo: datos.estilos.resumen }],
    adjunto: datos.adjuntoResumen,
    estiloFallbackAdjunto: datos.estilos.resumen,
    centradoAdjunto: true,
    paddingSuperior: 0,
    escalaAncho: datos.escalaResumenAncho,
    escalaAlto: datos.escalaResumenAlto,
    llenarPagina: false,
    forzarNuevaPagina: datos.nuevaPaginaAntesResumen,
  })

  await dibujarBloques(datos.comprobantes)
  await dibujarBloques(datos.facturaciones, {
    textoSinAdjunto: datos.textoSinFacturacion,
    estiloSinAdjunto: datos.estilos.sinFacturacion,
  })

  for (const estado of datos.estadosCuenta) {
    const tieneContenido =
      Boolean(estado.texto.trim()) ||
      Boolean(estado.detalle.trim()) ||
      Boolean(estado.adjunto)
    if (!tieneContenido) continue

    const textoEstado = estado.texto.trim()
      ? `ESTADO DE CUENTA CORRIENTE: ${estado.texto.trim()}`
      : 'ESTADO DE CUENTA CORRIENTE:'

    const textos: {
      texto: string
      estilo: EstiloFuente
      gapDespues?: number
    }[] = [{ texto: textoEstado, estilo: estado.estilo, gapDespues: mmToPt(4) }]

    if (estado.detalle.trim()) {
      textos.push({
        texto: estado.detalle.trim(),
        estilo: estado.estiloDetalle,
        gapDespues: mmToPt(2),
      })
    }

    await dibujarSeccionConAdjunto({
      textos,
      adjunto: estado.adjunto,
      estiloFallbackAdjunto: estado.estiloDetalle,
      centradoAdjunto: true,
      escalaAncho: estado.escalaAncho,
      escalaAlto: estado.escalaAlto,
      llenarPagina: false,
      forzarNuevaPagina: estado.nuevaPaginaAntes,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([Uint8Array.from(pdfBytes)], {
    type: 'application/pdf',
  })
  const url = URL.createObjectURL(blob)
  const nombreArchivo = `resumen-${datos.fecha.trim() || 'sin-fecha'}.pdf`

  return { blob, url, nombreArchivo }
}

export function descargarPdf(url: string, nombreArchivo: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  link.click()
}
