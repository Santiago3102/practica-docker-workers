from flask import Flask, jsonify, request
import mysql.connector
import os
import time

app = Flask(__name__)

WORKER_ID = int(os.environ.get("WORKER_ID", "1"))
MYSQL_HOST = os.environ.get("MYSQL_HOST", "mysql")

def get_db():
    return mysql.connector.connect(
        host=MYSQL_HOST,
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
            print(f"Worker {WORKER_ID} conectado a MySQL")
            return
        except Exception as e:
            print(f"Worker {WORKER_ID} esperando MySQL... {e}")
            time.sleep(3)

@app.route("/recibir", methods=["POST"])
def recibir():
    """Recibe un fragmento del archivo y lo guarda en MySQL."""
    data = request.json
    worker_id = data.get("worker_id", WORKER_ID)
    lineas = data.get("lineas", [])
    inicio = data.get("inicio", 1)

    try:
        conn = get_db()
        cursor = conn.cursor()

        for i, linea in enumerate(lineas):
            numero_linea = inicio + i
            cursor.execute(
                "INSERT INTO procesamiento (worker_id, linea_numero, contenido) VALUES (%s, %s, %s)",
                (worker_id, numero_linea, linea)
            )

        conn.commit()
        cursor.close()
        conn.close()

        print(f"Worker {WORKER_ID}: guardadas {len(lineas)} líneas (L{inicio}-L{inicio + len(lineas) - 1})")
        return jsonify({
            "worker_id": WORKER_ID,
            "lineas_guardadas": len(lineas),
            "rango_inicio": inicio,
            "rango_fin": inicio + len(lineas) - 1
        })

    except Exception as e:
        print(f"Worker {WORKER_ID} error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"worker_id": WORKER_ID, "status": "ok"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)