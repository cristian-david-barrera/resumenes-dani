import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { pool, testConnection } from "./db.js";
import {
  contarPdfsPorCarpeta,
  crearCarpeta,
  eliminarCarpeta,
  eliminarPdf,
  guardarPdf,
  importarLote,
  listarCarpetas,
  listarPdfs,
  moverPdf,
  obtenerPdf,
  raizResumenes,
  renombrarCarpeta,
  renombrarPdf,
  type PdfCarpeta,
} from "./resumenesStore.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "80mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", resumenesPath: raizResumenes() });
});

app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query<{ now: Date }>("SELECT NOW() AS now");
    res.json({
      status: "ok",
      database: "daniela",
      time: result.rows[0]?.now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ status: "error", message });
  }
});

app.get("/api/resumenes/ruta", (_req, res) => {
  res.json({ ruta: raizResumenes() });
});

app.get("/api/resumenes/carpetas", async (_req, res) => {
  try {
    res.json({ carpetas: await listarCarpetas() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.post("/api/resumenes/carpetas", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre ?? "");
    const carpeta = await crearCarpeta(nombre);
    res.status(201).json(carpeta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.patch("/api/resumenes/carpetas/:id", async (req, res) => {
  try {
    const carpeta = await renombrarCarpeta(
      req.params.id,
      String(req.body?.nombre ?? ""),
    );
    if (!carpeta) {
      res.status(404).json({ message: "Carpeta no encontrada" });
      return;
    }
    res.json(carpeta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.delete("/api/resumenes/carpetas/:id", async (req, res) => {
  try {
    await eliminarCarpeta(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.get("/api/resumenes/conteos", async (_req, res) => {
  try {
    res.json({ conteos: await contarPdfsPorCarpeta() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.get("/api/resumenes/pdfs", async (req, res) => {
  try {
    const raw = req.query.carpetaId;
    let carpetaId: string | null | undefined = undefined;
    if (raw === "null" || raw === "") carpetaId = null;
    else if (typeof raw === "string") carpetaId = raw;
    res.json({ pdfs: await listarPdfs(carpetaId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.get("/api/resumenes/pdfs/:id", async (req, res) => {
  try {
    const item = await obtenerPdf(req.params.id);
    if (!item) {
      res.status(404).json({ message: "PDF no encontrado" });
      return;
    }
    res.json({
      ...item.meta,
      bytesBase64: item.bytes.toString("base64"),
      datosFormulario: item.datosFormulario,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.post("/api/resumenes/pdfs", async (req, res) => {
  try {
    const bytesBase64 = String(req.body?.bytesBase64 ?? "");
    if (!bytesBase64) {
      res.status(400).json({ message: "Falta el PDF (bytesBase64)" });
      return;
    }
    const meta = await guardarPdf({
      nombre: String(req.body?.nombre ?? ""),
      bytes: Buffer.from(bytesBase64, "base64"),
      carpetaId:
        req.body?.carpetaId === undefined
          ? null
          : (req.body.carpetaId as string | null),
      nombreArchivoSugerido: req.body?.nombreArchivoSugerido
        ? String(req.body.nombreArchivoSugerido)
        : undefined,
      datosFormulario: req.body?.datosFormulario ?? null,
      idExistente: req.body?.idExistente
        ? String(req.body.idExistente)
        : null,
    });
    res.status(201).json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.patch("/api/resumenes/pdfs/:id", async (req, res) => {
  try {
    if (typeof req.body?.nombre === "string") {
      const meta = await renombrarPdf(req.params.id, req.body.nombre);
      if (!meta) {
        res.status(404).json({ message: "PDF no encontrado" });
        return;
      }
      res.json(meta);
      return;
    }
    if ("carpetaId" in (req.body ?? {})) {
      const meta = await moverPdf(
        req.params.id,
        (req.body.carpetaId as string | null) ?? null,
      );
      if (!meta) {
        res.status(404).json({ message: "PDF no encontrado" });
        return;
      }
      res.json(meta);
      return;
    }
    res.status(400).json({ message: "Nada para actualizar" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.delete("/api/resumenes/pdfs/:id", async (req, res) => {
  try {
    await eliminarPdf(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

app.post("/api/resumenes/importar", async (req, res) => {
  try {
    const carpetas = (req.body?.carpetas ?? []) as PdfCarpeta[];
    const pdfs = (req.body?.pdfs ?? []) as Array<{
      id: string;
      carpetaId: string | null;
      nombre: string;
      nombreArchivo: string;
      createdAt: number;
      updatedAt: number;
      bytesBase64: string;
      datosFormulario?: unknown | null;
    }>;
    const resultado = await importarLote({ carpetas, pdfs });
    res.json(resultado);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(500).json({ message });
  }
});

async function start() {
  try {
    await testConnection();
    console.log("Conectado a PostgreSQL (daniela)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("No se pudo conectar a PostgreSQL:", message);
    console.error("Revisa DATABASE_URL en backend/.env");
  }

  console.log(`PDF persistentes en: ${raizResumenes()}`);

  app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`);
  });
}

void start();
