# Laboratorio de Sistemas Distribuidos
### Particionamiento y Procesamiento Distribuido con Docker

**Tecnologías:** Python · Flask · MySQL · Docker · JavaScript · Nginx

---

## ¿Qué hace este proyecto?

El sistema recibe un archivo de texto, lo divide equitativamente entre varios Workers (contenedores Docker independientes), y cada Worker guarda su fragmento en una base de datos MySQL. Todo el proceso se visualiza en tiempo real desde una interfaz web.

```
Archivo de texto
      ↓
   Backend (Python/Flask)   ← divide las líneas
      ↓
 ┌────┬────┬────┬────┬────┐
 W1   W2   W3   W4   W5    ← 5 contenedores Docker independientes
 └────┴────┴────┴────┴────┘
      ↓
   MySQL                   ← persistencia centralizada
      ↓
   Frontend (Nginx)        ← visualización en el navegador
```

---

## Estructura del proyecto

```
Laboratorio/
├── docker-compose.yml        # Orquestación de todos los contenedores
├── backend/
│   ├── Dockerfile
│   ├── app.py                # API REST: coordina y distribuye el trabajo
│   └── requirements.txt
├── worker/
│   ├── Dockerfile
│   ├── worker.py             # Recibe líneas y las guarda en MySQL
│   └── requirements.txt
└── frontend/
    ├── Dockerfile
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## Docker en este proyecto

Docker es la herramienta central que hace posible este sistema. Sin Docker, ejecutar 5 servidores Python independientes + MySQL + Nginx en una sola máquina requeriría configuración manual compleja y propensa a conflictos.

### ¿Qué aporta Docker aquí?

**Contenedores aislados:** Cada Worker corre en su propio contenedor con su propio proceso, sistema de archivos y memoria. Si uno falla, los demás siguen funcionando.

**Misma imagen, múltiples instancias:** Los 5 Workers usan exactamente el mismo `Dockerfile` y el mismo `worker.py`. Docker Compose los instancia 5 veces como contenedores separados, diferenciados únicamente por la variable de entorno `WORKER_ID`.

**Red virtual automática:** Docker Compose crea una red privada entre todos los contenedores. Por eso el backend puede conectarse a MySQL simplemente con `host="mysql"` y comunicarse con cada worker usando `http://worker_1:5000` — Docker resuelve esos nombres internamente.

**Healthcheck:** MySQL tarda unos segundos en inicializarse. El `healthcheck` en el `docker-compose.yml` hace que los Workers y el Backend esperen a que MySQL esté listo antes de intentar conectarse, evitando errores de arranque.

**Sin instalación local:** MySQL, Nginx y Python corren dentro de Docker. No necesitas instalar nada de eso en tu máquina — Docker descarga las imágenes oficiales y las ejecuta en contenedores aislados.

### ¿Por qué esto importa en sistemas distribuidos?

Un sistema distribuido distribuye el trabajo entre múltiples nodos independientes que colaboran. Los problemas clásicos de estos sistemas son: entornos heterogéneos, sincronización entre nodos, y tolerancia a fallos.

Docker resuelve directamente el problema de entornos heterogéneos: garantiza que cada nodo ejecute exactamente el mismo entorno sin importar el hardware o sistema operativo subyacente. Esto es lo que permite que en producción un sistema como este corra en decenas o cientos de servidores físicos distintos y se comporte de forma predecible.

Lo que este laboratorio implementa a pequeña escala es el mismo patrón que usa Apache Spark para procesar terabytes de datos, o Netflix para escalar sus microservicios: dividir el trabajo, distribuirlo entre Workers independientes, y consolidar los resultados en un almacenamiento central.

---

## Cómo ejecutarlo

**Requisitos:** tener Docker Desktop instalado y corriendo.

```bash
# 1. Entrar a la carpeta del proyecto
cd Laboratorio

# 2. Construir las imágenes e iniciar todos los contenedores
docker compose up --build
```

Esperar hasta ver en la terminal:
```
worker_1  | ✅ Worker 1 conectado a MySQL
worker_2  | ✅ Worker 2 conectado a MySQL
...
backend   | ✅ Base de datos inicializada
```

Luego abrir el navegador en **http://localhost**

```bash
# Para detener el sistema
docker compose down
```

---

## Uso de la interfaz

1. Cargar un archivo `.txt` o pulsar **⚡ Generar archivo demo**
2. Ajustar el slider para elegir entre 1 y 5 Workers
3. Pulsar **▶ Procesar Archivo**
4. Pulsar **📊 Ver Resultados DB** para consultar los datos en MySQL
5. Pulsar **🗑 Limpiar BD** para resetear y hacer una nueva prueba

---

## API del Backend

| Endpoint | Método | Descripción |
|---|---|---|
| `/procesar` | POST | Recibe las líneas y `num_workers`, divide y distribuye |
| `/resultados` | GET | Devuelve todos los registros de MySQL |
| `/limpiar` | POST | Elimina todos los registros de la base de datos |
| `/health` | GET | Verifica que el backend está activo |

---

## Base de datos

Tabla `procesamiento` en MySQL:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Identificador único del registro |
| `worker_id` | INT | Qué Worker procesó esta línea |
| `linea_numero` | INT | Número de línea en el archivo original |
| `contenido` | TEXT | Texto de la línea |
| `timestamp` | DATETIME | Cuándo fue procesada |