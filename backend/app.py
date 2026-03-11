from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import mysql.connector
import os
import time

app = Flask(__name__)
CORS(app)

WORKERS = {
    1: "http://worker_1:5000",
    2: "http://worker_2:5000",
    3: "http://worker_3:5000",
    4: "http://worker_4:5000",
    5: "http://worker_5:5000",
}

def get_db():
    return mysql.connector.connect(
        host=os.environ.get("MYSQL_HOST", "mysql"),
        user="root",
        password="laboratorio123",
        database="laboratorio"
    )

def init_db():
    retries = 10
    for i in range(retries):
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS procesamiento (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    worker_id INT NOT NULL,
                    linea_numero INT NOT NULL,
                    contenido TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            cursor.close()
            conn.close()
            print("✅ Base de datos inicializada")
            return
        except Exception as e:
            print(f"⏳ Esperando MySQL... intento {i+1}/{retries}: {e}")
            time.sleep(3)
    print("❌ No se pudo conectar a MySQL")


def dividir_en_fragmentos(lineas, num_workers):
    """
    Divide las líneas en fragmentos lo más iguales posible.

    Ejemplo: 10 líneas, 3 workers
      base    = 10 // 3 = 3
      sobrante = 10 %  3 = 1
      → Worker 1: 4 líneas  (recibe la sobrante)
      → Worker 2: 3 líneas
      → Worker 3: 3 líneas

    La diferencia entre workers nunca es mayor a 1 línea.
    """
    total    = len(lineas)
    base     = total // num_workers
    sobrante = total % num_workers

    fragmentos = []
    inicio = 0
    for i in range(num_workers):
        extra = 1 if i < sobrante else 0
        fin   = inicio + base + extra
        fragmentos.append(lineas[inicio:fin])
        inicio = fin

    return fragmentos


@app.route("/procesar", methods=["POST"])
def procesar():
    data       = request.json
    lineas     = data.get("lineas", [])
    num_workers = int(data.get("num_workers", 5))

    if len(lineas) == 0:
        return jsonify({"error": "El archivo está vacío"}), 400

    if num_workers < 1 or num_workers > 5:
        return jsonify({"error": "El número de workers debe estar entre 1 y 5"}), 400

    if num_workers > len(lineas):
        return jsonify({"error": f"No puedes usar más workers ({num_workers}) que líneas ({len(lineas)})"}), 400

    fragmentos = dividir_en_fragmentos(lineas, num_workers)
    resultados = []
    linea_acumulada = 1

    for i, fragmento in enumerate(fragmentos):
        worker_id     = i + 1
        inicio_global = linea_acumulada

        try:
            requests.post(
                f"{WORKERS[worker_id]}/recibir",
                json={"worker_id": worker_id, "lineas": fragmento, "inicio": inicio_global},
                timeout=10
            )
            resultados.append({
                "worker_id":       worker_id,
                "status":          "ok",
                "lineas_recibidas": len(fragmento),
                "rango":           f"{inicio_global}-{inicio_global + len(fragmento) - 1}"
            })
        except Exception as e:
            resultados.append({
                "worker_id": worker_id,
                "status":    "error",
                "error":     str(e)
            })

        linea_acumulada += len(fragmento)

    return jsonify({
        "mensaje":       "Procesamiento completado",
        "total_lineas":  len(lineas),
        "workers_usados": num_workers,
        "workers":       resultados
    })


@app.route("/resultados", methods=["GET"])
def resultados():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM procesamiento ORDER BY worker_id, linea_numero")
        rows   = cursor.fetchall()
        for row in rows:
            if row.get("timestamp"):
                row["timestamp"] = str(row["timestamp"])
        cursor.close()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/limpiar", methods=["POST"])
def limpiar():
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM procesamiento")
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": "Base de datos limpiada"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8000, debug=False)