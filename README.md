# Proyecto Daniela

Stack:

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL (`daniela`)

## Requisitos

- Node.js 20+
- PostgreSQL 17

## Configuración

1. En `backend/.env` (copia desde `.env.example` si hace falta):

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/daniela
```

2. La base `daniela` debe existir en PostgreSQL.

## Desarrollo

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Health API: http://localhost:3001/api/health
- Health DB: http://localhost:3001/api/db-health

## Uso en otra PC (doble clic)

En la carpeta `SCRIPT/`:

1. Primera vez / actualizaciones: `ACTUALIZAR SISTEMA.bat`
2. Para usar: `INICIAR SISTEMA.bat`
3. Para apagar: `DETENER SISTEMA.bat`

Ver también `SCRIPT/LEEME.txt`.
