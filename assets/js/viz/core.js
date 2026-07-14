// ============================================================
//  core.js — utilidades compartidas por todas las visualizaciones
//  (helpers, cajas, registro de métricas y popup de detalle)
// ============================================================

export const COLORES = ['#3d5c35', '#5c7a52', '#b8965a', '#c47c35', '#a8bc9e', '#d4b87a']

export const esc  = (s) => (s ?? '').toString()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
export const norm = (t) => (t ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
export const baseOpts = (extra = {}) =>
  Object.assign({ responsive: true, maintainAspectRatio: false }, extra)

// ---------- Detalle por curso (se llena desde datos.js) ----------
export const DET = { E2: [], E3: [] }
export const aCol = (rows) => rows.map((r) => ({
  codigo_curso: r.codigo_curso, colegio: r.colegio, localidad: r.localidad,
}))

// ---------- Cajas ----------
export function box(id, { nube = false } = {}) {
  const el = document.getElementById(id); if (!el) return null
  el.classList.add('viz-box', 'viz-clickable')
  el.classList.remove('viz-placeholder')
  if (nube) el.classList.add('viz-nube')
  return el
}
export function vacio(id, texto) {
  const el = document.getElementById(id)
  el?.querySelector('strong')?.insertAdjacentHTML('afterend',
    `<small class="d-block mt-2 text-muted">${texto}</small>`)
}

// ---------- Tooltip flotante (compartido) ----------
export function conTooltip(el, nodos, contenido) {
  let tip = el.querySelector('.viz-tip')
  if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip'; el.appendChild(tip) }
  nodos.forEach((n) => {
    n.addEventListener('mouseenter', () => {
      el.classList.add('atenuado'); n.classList.add('activo')
      tip.innerHTML = contenido(n); tip.style.opacity = 1
    })
    n.addEventListener('mousemove', (ev) => {
      const r = el.getBoundingClientRect()
      tip.style.left = (ev.clientX - r.left + 14) + 'px'
      tip.style.top  = (ev.clientY - r.top  - 12) + 'px'
    })
    n.addEventListener('mouseleave', () => {
      el.classList.remove('atenuado'); n.classList.remove('activo'); tip.style.opacity = 0
    })
  })
  return tip
}

// ---------- Registro de métricas + popup ----------
export const METR = {}
let modalChart = null

export function registrar(id, cfg) { METR[id] = cfg }
// cfg = { titulo, descripcion, total, render(el, onPick), filtro(op) -> colegios,
//         nube?, mostrarTexto?, quemado? }

export function pintarPanel(id, op, label) {
  const m = METR[id]
  const panel = document.getElementById('viz-modal-panel')
  let html = `<p class="metric-desc mb-3">${m.descripcion}</p>`
  if (m.quemado) {
    html += `<p class="aviso-quemado mb-3"><span class="ast">*</span> Datos de ejemplo — aún no provienen de la base de datos.</p>`
  }
  if (op == null) {
    html += `<p class="text-muted small mb-0"><i class="bi bi-hand-index"></i> Haz clic en un elemento de la gráfica para ver el detalle.</p>`
  } else {
    const colegios = m.filtro ? m.filtro(op) : []
    const pct = m.total ? Math.round((colegios.length / m.total) * 100) : null
    const lista = colegios.slice()
      .sort((a, b) => (a.colegio || '').localeCompare(b.colegio || '', 'es'))
      .map((c) => `<li><a href="bitacora_detalle.html?curso=${encodeURIComponent(c.codigo_curso)}">${esc(c.colegio)} · ${esc(c.codigo_curso)}</a><span class="loc">${esc(c.localidad || '')}</span></li>`).join('')
    html += `<div class="mb-2"><span class="badge" style="background:var(--verde-medio);">${esc(label || op)}</span></div>`
    if (m.mostrarTexto !== false && label == null) html += `<p class="opcion-full mb-3">${esc(op)}</p>`
    if (m.quemado) {
      const n = m.valorDe ? m.valorDe(op) : null
      const p = (n != null && m.total) ? Math.round((n / m.total) * 100) : null
      html += `<p class="mb-2"><span class="big-num">${n ?? '—'}</span> <span class="text-muted">registro(s)${p != null ? ` · ${p}% del total` : ''}</span></p>`
      html += `<p class="text-muted small mb-0">La lista de colegios aparecerá cuando estos datos se carguen a la base.</p>`
    } else {
      html += `<p class="mb-2"><span class="big-num">${colegios.length}</span> <span class="text-muted">curso(s)${pct != null ? ` · ${pct}% del total` : ''}</span></p>`
      html += `<ul class="lista-colegios">${lista || '<li class="text-muted">Sin registros.</li>'}</ul>`
    }
  }
  panel.innerHTML = html
}

export function abrirViz(id, pre = null, preLabel = null) {
  const m = METR[id]; if (!m) return
  document.getElementById('viz-modal-titulo').textContent = m.titulo
  const el = document.getElementById('viz-modal-box')
  el.className = 'viz-modal-box' + (m.nube ? ' viz-nube' : '')
  if (modalChart) { modalChart.destroy(); modalChart = null }
  const c = m.render(el, (op, label) => pintarPanel(id, op, label))
  if (c && c.destroy) modalChart = c
  pintarPanel(id, pre, preLabel)
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalViz')).show()
}

// ---------- Texto verde desplegable ----------
export function activarDesplegables() {
  document.querySelectorAll('#panel-fase2 .data-row, #panel-fase3 .data-row, #panel-participacion .data-row')
    .forEach((row, i) => {
      const opts = row.querySelector('.data-options'); const arrow = row.querySelector('.arrow-icon')
      if (!opts || !arrow) return
      opts.id = opts.id || `opts-${i}`; opts.classList.add('collapse')
      const col = new bootstrap.Collapse(opts, { toggle: false }); let abierto = false
      arrow.setAttribute('role', 'button'); arrow.setAttribute('title', 'Ver/ocultar opciones')
      arrow.addEventListener('click', () => {
        abierto = !abierto; col[abierto ? 'show' : 'hide'](); arrow.classList.toggle('abierto', abierto)
      })
    })
}
