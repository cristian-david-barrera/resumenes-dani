import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { pool, testConnection } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
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

async function start() {
  try {
    await testConnection();
    console.log("Conectado a PostgreSQL (daniela)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("No se pudo conectar a PostgreSQL:", message);
    console.error("Revisa DATABASE_URL en backend/.env");
  }

  app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`);
  });
}

void start();
