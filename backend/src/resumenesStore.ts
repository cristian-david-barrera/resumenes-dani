import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type PdfCarpeta = {
  id: string;
  nombre: string;
  createdAt: number;
  updatedAt: number;
};

export type PdfMetaDisco = {
  id: string;
  carpetaId: string | null;
  nombre: string;
  nombreArchivo: string;
  createdAt: number;
  updatedAt: number;
  tamanioBytes: number;
  editable: boolean;
};

type IndiceResumenes = {
  carpetas: PdfCarpeta[];
  pdfs: PdfMetaDisco[];
};

function carpetaDocumentosUsuario(): string {
  const home = homedir();
  for (const nombre of ["Documents", "Documentos"] as const) {
    const ruta = join(home, nombre);
    if (existsSync(ruta)) return ruta;
  }
  return join(home, "Documents");
}

export function raizResumenes(): string {
  return join(carpetaDocumentosUsuario(), "resumenes");
}

function rutaIndice(): string {
  return join(raizResumenes(), "index.json");
}

function rutaPdf(id: string): string {
  return join(raizResumenes(), "archivos", `${id}.pdf`);
}

function rutaFormulario(id: string): string {
  return join(raizResumenes(), "archivos", `${id}.form.json`);
}

async function asegurarRaiz(): Promise<void> {
  await mkdir(join(raizResumenes(), "archivos"), { recursive: true });
}

async function leerIndice(): Promise<IndiceResumenes> {
  await asegurarRaiz();
  try {
    const raw = await readFile(rutaIndice(), "utf8");
    const parsed = JSON.parse(raw) as IndiceResumenes;
    return {
      carpetas: Array.isArray(parsed.carpetas) ? parsed.carpetas : [],
      pdfs: Array.isArray(parsed.pdfs) ? parsed.pdfs : [],
    };
  } catch {
    return { carpetas: [], pdfs: [] };
  }
}

async function escribirIndice(indice: IndiceResumenes): Promise<void> {
  await asegurarRaiz();
  await writeFile(rutaIndice(), JSON.stringify(indice, null, 2), "utf8");
}

function sanitizarNombreArchivo(nombre: string): string {
  const limpio = nombre
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  const base = limpio || "resumen";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function listarCarpetas(): Promise<PdfCarpeta[]> {
  const indice = await leerIndice();
  return [...indice.carpetas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );
}

export async function crearCarpeta(nombre: string): Promise<PdfCarpeta> {
  const ahora = Date.now();
  const carpeta: PdfCarpeta = {
    id: randomUUID(),
    nombre: nombre.trim() || "Sin nombre",
    createdAt: ahora,
    updatedAt: ahora,
  };
  const indice = await leerIndice();
  indice.carpetas.push(carpeta);
  await escribirIndice(indice);
  return carpeta;
}

export async function renombrarCarpeta(
  id: string,
  nombre: string,
): Promise<PdfCarpeta | null> {
  const indice = await leerIndice();
  const carpeta = indice.carpetas.find((c) => c.id === id);
  if (!carpeta) return null;
  carpeta.nombre = nombre.trim() || "Sin nombre";
  carpeta.updatedAt = Date.now();
  await escribirIndice(indice);
  return carpeta;
}

export async function eliminarCarpeta(id: string): Promise<void> {
  const indice = await leerIndice();
  const pdfs = indice.pdfs.filter((p) => p.carpetaId === id);
  for (const pdf of pdfs) {
    await rm(rutaPdf(pdf.id), { force: true });
    await rm(rutaFormulario(pdf.id), { force: true });
  }
  indice.pdfs = indice.pdfs.filter((p) => p.carpetaId !== id);
  indice.carpetas = indice.carpetas.filter((c) => c.id !== id);
  await escribirIndice(indice);
}

export async function contarPdfsPorCarpeta(): Promise<Record<string, number>> {
  const indice = await leerIndice();
  const conteo: Record<string, number> = {};
  for (const pdf of indice.pdfs) {
    const clave = pdf.carpetaId ?? "__sin_carpeta__";
    conteo[clave] = (conteo[clave] ?? 0) + 1;
  }
  return conteo;
}

export async function listarPdfs(
  carpetaId?: string | null,
): Promise<PdfMetaDisco[]> {
  const indice = await leerIndice();
  return indice.pdfs
    .filter((item) =>
      carpetaId === undefined ? true : item.carpetaId === carpetaId,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function obtenerPdf(id: string): Promise<{
  meta: PdfMetaDisco;
  bytes: Buffer;
  datosFormulario: unknown | null;
} | null> {
  const indice = await leerIndice();
  const meta = indice.pdfs.find((p) => p.id === id);
  if (!meta) return null;

  const bytes = await readFile(rutaPdf(id));
  let datosFormulario: unknown | null = null;
  try {
    const raw = await readFile(rutaFormulario(id), "utf8");
    datosFormulario = JSON.parse(raw) as unknown;
  } catch {
    datosFormulario = null;
  }

  return { meta, bytes, datosFormulario };
}

export async function guardarPdf(opciones: {
  nombre: string;
  bytes: Buffer;
  carpetaId?: string | null;
  nombreArchivoSugerido?: string;
  datosFormulario?: unknown | null;
  idExistente?: string | null;
}): Promise<PdfMetaDisco> {
  const ahora = Date.now();
  const nombre = opciones.nombre.trim() || "Sin nombre";
  const nombreArchivo =
    opciones.nombreArchivoSugerido?.trim() || sanitizarNombreArchivo(nombre);
  const indice = await leerIndice();

  let meta: PdfMetaDisco;
  const idExistente = opciones.idExistente?.trim() || null;

  if (idExistente) {
    const actual = indice.pdfs.find((p) => p.id === idExistente);
    if (actual) {
      meta = {
        ...actual,
        carpetaId: opciones.carpetaId ?? actual.carpetaId,
        nombre,
        nombreArchivo,
        updatedAt: ahora,
        tamanioBytes: opciones.bytes.byteLength,
        editable: opciones.datosFormulario != null ? true : actual.editable,
      };
      const idx = indice.pdfs.findIndex((p) => p.id === idExistente);
      indice.pdfs[idx] = meta;
    } else {
      meta = {
        id: randomUUID(),
        carpetaId: opciones.carpetaId ?? null,
        nombre,
        nombreArchivo,
        createdAt: ahora,
        updatedAt: ahora,
        tamanioBytes: opciones.bytes.byteLength,
        editable: opciones.datosFormulario != null,
      };
      indice.pdfs.push(meta);
    }
  } else {
    meta = {
      id: randomUUID(),
      carpetaId: opciones.carpetaId ?? null,
      nombre,
      nombreArchivo,
      createdAt: ahora,
      updatedAt: ahora,
      tamanioBytes: opciones.bytes.byteLength,
      editable: opciones.datosFormulario != null,
    };
    indice.pdfs.push(meta);
  }

  await asegurarRaiz();
  await writeFile(rutaPdf(meta.id), opciones.bytes);
  if (opciones.datosFormulario != null) {
    await writeFile(
      rutaFormulario(meta.id),
      JSON.stringify(opciones.datosFormulario),
      "utf8",
    );
  }
  await escribirIndice(indice);
  return meta;
}

export async function renombrarPdf(
  id: string,
  nombre: string,
): Promise<PdfMetaDisco | null> {
  const indice = await leerIndice();
  const pdf = indice.pdfs.find((p) => p.id === id);
  if (!pdf) return null;
  const nuevoNombre = nombre.trim() || "Sin nombre";
  pdf.nombre = nuevoNombre;
  pdf.nombreArchivo = sanitizarNombreArchivo(nuevoNombre);
  pdf.updatedAt = Date.now();
  await escribirIndice(indice);
  return pdf;
}

export async function moverPdf(
  id: string,
  carpetaId: string | null,
): Promise<PdfMetaDisco | null> {
  const indice = await leerIndice();
  const pdf = indice.pdfs.find((p) => p.id === id);
  if (!pdf) return null;
  pdf.carpetaId = carpetaId;
  pdf.updatedAt = Date.now();
  await escribirIndice(indice);
  return pdf;
}

export async function eliminarPdf(id: string): Promise<void> {
  const indice = await leerIndice();
  indice.pdfs = indice.pdfs.filter((p) => p.id !== id);
  await escribirIndice(indice);
  await rm(rutaPdf(id), { force: true });
  await rm(rutaFormulario(id), { force: true });
}

/** Importa un lote (p. ej. migración desde IndexedDB del navegador). */
export async function importarLote(opciones: {
  carpetas: PdfCarpeta[];
  pdfs: Array<{
    id: string;
    carpetaId: string | null;
    nombre: string;
    nombreArchivo: string;
    createdAt: number;
    updatedAt: number;
    bytesBase64: string;
    datosFormulario?: unknown | null;
  }>;
}): Promise<{ importados: number; ruta: string }> {
  const indice = await leerIndice();
  const idsCarpetas = new Set(indice.carpetas.map((c) => c.id));
  const idsPdfs = new Set(indice.pdfs.map((p) => p.id));

  for (const carpeta of opciones.carpetas) {
    if (idsCarpetas.has(carpeta.id)) continue;
    indice.carpetas.push(carpeta);
    idsCarpetas.add(carpeta.id);
  }

  let importados = 0;
  await asegurarRaiz();
  for (const pdf of opciones.pdfs) {
    if (idsPdfs.has(pdf.id)) continue;
    const bytes = Buffer.from(pdf.bytesBase64, "base64");
    const tmp = join(raizResumenes(), "archivos", `${pdf.id}.pdf.tmp`);
    await writeFile(tmp, bytes);
    await rename(tmp, rutaPdf(pdf.id));
    if (pdf.datosFormulario != null) {
      await writeFile(
        rutaFormulario(pdf.id),
        JSON.stringify(pdf.datosFormulario),
        "utf8",
      );
    }
    indice.pdfs.push({
      id: pdf.id,
      carpetaId: pdf.carpetaId,
      nombre: pdf.nombre,
      nombreArchivo: pdf.nombreArchivo,
      createdAt: pdf.createdAt,
      updatedAt: pdf.updatedAt,
      tamanioBytes: bytes.byteLength,
      editable: pdf.datosFormulario != null,
    });
    idsPdfs.add(pdf.id);
    importados += 1;
  }

  await escribirIndice(indice);
  return { importados, ruta: raizResumenes() };
}
