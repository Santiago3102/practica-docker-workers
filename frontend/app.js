// ===== CONFIGURACIÓN =====
const BACKEND = 'http://localhost:8000';

const WORKER_COLORS = {
  1: '#00d4ff',
  2: '#ff6b35',
  3: '#00ff88',
  4: '#ffd700',
  5: '#bf7fff'
};

let fileLines  = [];
let numWorkers = 5;  // valor por defecto

// ===== RELOJ =====
setInterval(() => {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('es-CO');
}, 1000);


// ===== SELECTOR DE WORKERS =====
function actualizarWorkers(valor) {
  numWorkers = parseInt(valor);
  document.getElementById('workerValue').textContent = `${numWorkers} worker${numWorkers > 1 ? 's' : ''}`;
  initWorkers(numWorkers);

  // Actualizar hint de líneas por worker
  if (fileLines.length > 0) {
    const base     = Math.floor(fileLines.length / numWorkers);
    const sobrante = fileLines.length % numWorkers;
    const hint     = sobrante > 0
      ? `~${base}–${base + 1} líneas`
      : `${base} líneas`;
    document.getElementById('linesPerWorker').textContent = hint;
  } else {
    document.getElementById('linesPerWorker').textContent = '—';
  }
}


// ===== INICIALIZAR TARJETAS DE WORKERS =====
function initWorkers(cantidad = 5) {
  const container = document.getElementById('workersSection');
  container.innerHTML = '';

  for (let i = 1; i <= cantidad; i++) {
    container.innerHTML += `
      <div class="worker-card" id="worker${i}" style="--worker-color:${WORKER_COLORS[i]}">
        <div class="worker-id">W${i}</div>
        <div class="worker-name">Worker ${i}</div>
        <div class="worker-lines">Líneas <span id="wlines${i}">—</span></div>
        <div class="progress-bar">
          <div class="progress-fill" id="wprog${i}"></div>
        </div>
        <div class="worker-status" id="wstatus${i}">en espera</div>
      </div>`;
  }
}


// ===== LOG DEL SISTEMA =====
function log(msg, type = '') {
  const body = document.getElementById('logBody');
  const time = new Date().toLocaleTimeString('es-CO');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg ${type}">${msg}</span>`;
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
}


// ===== VERIFICAR BACKEND =====
async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/health`);
    if (r.ok) {
      document.getElementById('backendStatus').textContent = 'Backend: online ✓';
      document.getElementById('backendDot').className = 'status-dot online';
      log('Backend conectado correctamente', 'ok');
    }
  } catch {
    document.getElementById('backendStatus').textContent = 'Backend: offline ✗';
    document.getElementById('backendDot').className = 'status-dot';
    log('Backend no disponible — ¿está corriendo Docker?', 'error');
  }
}


// ===== CARGA DE ARCHIVOS =====
document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadFile(file);
});

const zone = document.getElementById('uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim() !== '');
    fileLines = lines;

    document.getElementById('fileInfo').classList.add('visible');
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileMeta').textContent = `${lines.length} líneas · ${file.size} bytes`;

    const badge = document.getElementById('fileBadge');

    if (lines.length >= 1) {
      badge.textContent = `✓ ${lines.length} LÍNEAS`;
      badge.style.color = 'var(--green)';
      badge.style.borderColor = 'var(--green)';
      document.getElementById('btnProcesar').disabled = false;
      log(`Archivo cargado: ${file.name} — ${lines.length} líneas`, 'ok');
    } else {
      badge.textContent = '⚠ VACÍO';
      badge.style.color = 'var(--red)';
      badge.style.borderColor = 'var(--red)';
      document.getElementById('btnProcesar').disabled = true;
      log('El archivo está vacío', 'error');
    }

    // Actualizar hint del selector
    actualizarWorkers(numWorkers);
  };
  reader.readAsText(file);
}

function generarEjemplo() {
  fileLines = Array.from({ length: 100 }, (_, i) =>
    `Línea ${String(i + 1).padStart(3, '0')}: Registro generado — valor=${Math.floor(Math.random() * 1000)}`
  );

  document.getElementById('fileInfo').classList.add('visible');
  document.getElementById('fileName').textContent = 'archivo_demo.txt';
  document.getElementById('fileMeta').textContent = '100 líneas · generado automáticamente';

  const badge = document.getElementById('fileBadge');
  badge.textContent = '✓ 100 LÍNEAS';
  badge.style.color = 'var(--green)';
  badge.style.borderColor = 'var(--green)';
  document.getElementById('btnProcesar').disabled = false;
  log('Archivo de demostración generado — 100 líneas listas', 'ok');
  actualizarWorkers(numWorkers);
}


// ===== PROCESAR ARCHIVO =====
async function procesar() {
  if (fileLines.length === 0) return;

  document.getElementById('btnProcesar').disabled = true;
  log(`━━━ Iniciando procesamiento: ${fileLines.length} líneas → ${numWorkers} workers ━━━`, 'info');

  // Activar todos los workers en espera
  for (let i = 1; i <= numWorkers; i++) {
    const card   = document.getElementById(`worker${i}`);
    const status = document.getElementById(`wstatus${i}`);
    if (card) {
      card.classList.add('processing');
      status.className = 'worker-status processing';
      status.textContent = 'procesando...';
    }
  }

  try {
    const response = await fetch(`${BACKEND}/procesar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: fileLines, num_workers: numWorkers })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    // Actualizar tarjetas según resultado
    result.workers.forEach(w => {
      const card   = document.getElementById(`worker${w.worker_id}`);
      const status = document.getElementById(`wstatus${w.worker_id}`);
      const prog   = document.getElementById(`wprog${w.worker_id}`);
      const lines  = document.getElementById(`wlines${w.worker_id}`);
      if (!card) return;

      card.classList.remove('processing');

      if (w.status === 'ok') {
        card.classList.add('done');
        status.className = 'worker-status ok';
        status.textContent = `✓ ${w.lineas_recibidas} líneas guardadas`;
        if (lines) lines.textContent = `L${w.rango}`;
        log(`✓ Worker ${w.worker_id} → L${w.rango} (${w.lineas_recibidas} líneas)`, 'ok');
        setTimeout(() => { if (prog) prog.style.width = '100%'; }, 200 * w.worker_id);
      } else {
        status.className = 'worker-status error';
        status.textContent = '✗ error';
        log(`✗ Worker ${w.worker_id} falló: ${w.error}`, 'error');
      }
    });

    log(`━━━ Completado: ${result.total_lineas} líneas procesadas por ${result.workers_usados} workers ━━━`, 'ok');
    setTimeout(verResultados, 1500);

  } catch (err) {
    log(`Error: ${err.message}`, 'error');
    for (let i = 1; i <= numWorkers; i++) {
      const card = document.getElementById(`worker${i}`);
      if (card) card.classList.remove('processing');
    }
  }

  document.getElementById('btnProcesar').disabled = false;
}


// ===== VER RESULTADOS =====
async function verResultados() {
  log('Consultando base de datos MySQL...', 'info');
  try {
    const r    = await fetch(`${BACKEND}/resultados`);
    const data = await r.json();

    const section = document.getElementById('resultsSection');
    const tbody   = document.getElementById('resultsBody');
    section.classList.add('visible');

    document.getElementById('resultsCount').textContent = `${data.length} registros`;
    document.getElementById('totalProcessed').textContent = `Total registros: ${data.length}`;

    tbody.innerHTML = data.map(row => `
      <tr>
        <td style="color:var(--dim)">${row.id}</td>
        <td>
          <span class="worker-badge"
            style="background:${WORKER_COLORS[row.worker_id]}22;
                   color:${WORKER_COLORS[row.worker_id]};
                   border:1px solid ${WORKER_COLORS[row.worker_id]}44">
            W${row.worker_id}
          </span>
        </td>
        <td style="color:var(--accent)">${row.linea_numero}</td>
        <td style="color:var(--text); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
          ${row.contenido}
        </td>
        <td style="color:var(--dim)">${row.timestamp}</td>
      </tr>`
    ).join('');

    log(`${data.length} registros recuperados de MySQL`, 'ok');
    section.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    log(`Error al consultar MySQL: ${err.message}`, 'error');
  }
}


// ===== LIMPIAR BD =====
async function limpiarDB() {
  if (!confirm('¿Limpiar todos los registros de la base de datos?')) return;
  try {
    await fetch(`${BACKEND}/limpiar`, { method: 'POST' });
    document.getElementById('resultsBody').innerHTML = '';
    document.getElementById('resultsCount').textContent = '0 registros';
    document.getElementById('totalProcessed').textContent = 'Total registros: 0';
    initWorkers(numWorkers);
    log('Base de datos limpiada', 'warn');
  } catch (err) {
    log(`Error al limpiar: ${err.message}`, 'error');
  }
}


// ===== INICIALIZACIÓN =====
initWorkers(numWorkers);
checkBackend();
log('Sistema inicializado — esperando archivo...', 'info');