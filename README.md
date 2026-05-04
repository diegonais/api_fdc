# API FDC

API para ingesta y consulta de focos de calor usando NASA FIRMS.

## Proposito

Este proyecto permite:

- sincronizar detecciones de focos de calor desde NASA FIRMS,
- guardar las detecciones en PostgreSQL con deduplicacion,
- consultar detecciones con filtros y paginacion,
- mantener actualizada la base con un cron incremental.

## Fuente de datos

Los datos se obtienen desde NASA FIRMS (Fire Information for Resource Management System), usando el endpoint CSV por area.

- Proveedor: NASA FIRMS
- Base URL configurada por defecto: `https://firms.modaps.eosdis.nasa.gov/api/area/csv`
- Fuentes soportadas:
  - `VIIRS_SNPP_NRT`
  - `VIIRS_NOAA20_NRT`
  - `VIIRS_NOAA21_NRT`
  - `MODIS_NRT`
- Requiere API key en `FIRMS_MAP_KEY`

## Zona horaria (importante)

La variable `TZ` es clave en el comportamiento del sistema:

- define la zona horaria del cron,
- define la fecha actual usada para calcular el seed inicial por ventanas,
- se aplica tambien en PostgreSQL cuando usas `docker-compose`.

Valor recomendado para este proyecto:

```env
TZ=America/La_Paz
```

## Requisitos

- Node.js 20+
- Yarn 1.x
- PostgreSQL 16+ (o Docker con `docker-compose`)

## Configuracion inicial

1. Clonar el repositorio.
2. Instalar dependencias:

```bash
yarn install
```

3. Copiar el archivo de entorno:

```bash
cp .env.template .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.template .env
```

4. Editar `.env` y completar al menos:

- `FIRMS_MAP_KEY`
- `FIRMS_BBOX`
- credenciales de base de datos (`DB_*`) o `DATABASE_URL`
- `TZ` (si aplica)

## Flujo de arranque (automatico)

Para dejar el sistema funcional desde cero, el orden recomendado es:

1. Ejecutar migraciones.
2. Levantar la API.

Comandos:

```bash
yarn migration:run
yarn start:dev
```

Cuando la API inicia:

- si la tabla `detections` esta vacia:
  - ejecuta automaticamente la carga inicial desde `FIRMS_INITIAL_SYNC_START_DATE`,
  - al terminar, habilita el cron incremental (`FIRMS_SYNC_EVERY_MINUTES`).
- si `detections` ya tiene datos:
  - salta la carga inicial,
  - inicia el cron directamente.

## Seed inicial manual (opcional)

Si quieres ejecutar solo la carga inicial manualmente:

```bash
yarn firms:seed:initial
```

Este script deshabilita el cron durante su ejecucion (`FIRMS_DISABLE_CRON=true` solo para ese proceso).

## Variables FIRMS mas importantes

- `FIRMS_INITIAL_SYNC_START_DATE`: fecha inicial del primer seed (formato `YYYY-MM-DD`).
- `FIRMS_SYNC_EVERY_MINUTES`: frecuencia del cron incremental (1 a 59).
- `FIRMS_LOOKBACK_DAYS`: ventana en dias usada por el cron incremental.
- `FIRMS_ENABLED_SOURCES`: fuentes activas separadas por coma.
- `FIRMS_DISABLE_CRON`: si esta en `true`, no levanta cron al iniciar la app.

## Docker

Levantar solo PostgreSQL:

```bash
docker compose up -d db
```

Luego, desde tu entorno local:

```bash
yarn migration:run
yarn start:dev
```

Notas:

- `db` se inicia con PostgreSQL.
- la API se ejecuta localmente con `yarn start:dev`.
- evita levantar otra instancia de API en Docker para no duplicar cron/ingestas.
- recuerda ejecutar migraciones antes del primer uso de la API.

## Endpoints

- Swagger: `http://localhost:<PORT>/api_fdc/v1/docs`
- Health: `GET /api_fdc/v1/health`
- Detecciones: `GET /api_fdc/v1/detections`
- Detalle de deteccion: `GET /api_fdc/v1/detections/:id`
- Resumen de detecciones: `GET /api_fdc/v1/detections/stats/summary`
- Exportacion Excel: `GET /api_fdc/v1/detections/export/excel`
- Sync manual: `POST /api_fdc/v1/firms/sync`

## Scripts utiles

- `yarn start:dev`
- `yarn build`
- `yarn migration:run`
- `yarn migration:revert`
- `yarn firms:seed:initial`
