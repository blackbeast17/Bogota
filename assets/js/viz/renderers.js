// ============================================================
//  renderers.js — todas las visualizaciones
//  Cada render tiene la MISMA firma: (el, datos, onPick)
//  para que el registro/popup de core.js las trate igual.
// ============================================================
import { COLORES, esc, norm, baseOpts, conTooltip } from './core.js'
import { crearRuido, spline, arcoPath, figuraSVG, rotarIdles } from './formas.js'

// ---------- Barras y dona (Chart.js) ----------
export function renderBar(el, { labels, full, valores, colors, horizontal }, onPick) {
  el.innerHTML = '<canvas></canvas>'
  return new Chart(el.querySelector('canvas'), {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: colors }] },
    options: baseOpts({
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => full[it[0].dataIndex] } } },
      scales: { [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 } } },
      onClick: (e, els) => onPick && onPick(els.length ? full[els[0].index] : null),
    }),
  })
}
export function renderDoughnut(el, { labels, full, valores, colors }, onPick) {
  el.innerHTML = '<canvas></canvas>'
  return new Chart(el.querySelector('canvas'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: colors }] },
    options: baseOpts({
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { title: (it) => full[it[0].dataIndex] } } },
      onClick: (e, els) => onPick && onPick(els.length ? full[els[0].index] : null),
    }),
  })
}

// ---------- Nube de palabras ----------
export function renderNube(el, tokens, onPick) {
  const max = tokens[0].n, min = tokens[tokens.length - 1].n
  const rango = Math.max(1, max - min)

  // Tamaño: la palabra top DOMINA — pero el techo baja si hay muchos tokens,
  // para que nunca desborde la caja (eso era lo que se veía "deformado").
  const CAP = tokens.length > 22 ? 2.15 : tokens.length > 12 ? 2.6 : 3.1
  const TOP_MULT = tokens.length > 12 ? 1.28 : 1.42
  const size = (n, esTop) => {
    const t = (n - min) / rango
    const base = 0.6 + (CAP - 0.6) * Math.pow(t, 0.85)
    return Math.min(CAP * TOP_MULT, esTop ? base * TOP_MULT : base).toFixed(2)
  }
  // Color: MISMO tono (terracota del sitio), varía la LUMINOSIDAD según importancia
  // más mencionada -> oscuro y sólido; menos -> claro
  const color = (n) => {
    const t = (n - min) / rango             // 0..1
    const L = 68 - 34 * t                   // 68% (clara) -> 34% (oscura)
    const S = 42 + 26 * t                   // menos saturada las raras
    return `hsl(14, ${S.toFixed(0)}%, ${L.toFixed(0)}%)`
  }

  // Intercalar grandes/pequeñas, pero la TOP va en el centro visual
  const top = tokens[0]
  const resto = tokens.slice(1)
  const orden = []
  while (resto.length) {
    orden.push(resto.shift())
    if (resto.length) orden.push(resto.pop())
  }
  const medio = Math.floor(orden.length / 2)
  orden.splice(medio, 0, top)               // la principal, al centro

  el.innerHTML = `<div class="nube-wrap">${orden.map((t) => {
    const esTop = t === top
    return `<span data-word="${esc(norm(t.label))}" data-label="${esc(t.label)}"
      class="${esTop ? 'nube-top' : ''}"
      title="${t.n} menciones — clic para ver colegios"
      style="font-size:${size(t.n, esTop)}rem;color:${color(t.n)};">${esc(t.label)}</span>`
  }).join('')}</div>`

  const wrap = el.querySelector('.nube-wrap')
  el.querySelectorAll('.nube-wrap span').forEach((sp) => {
    sp.addEventListener('click', () => onPick && onPick(sp.dataset.word, sp.dataset.label))
    sp.addEventListener('mouseenter', () => wrap.classList.add('atenuada'))
    sp.addEventListener('mouseleave', () => wrap.classList.remove('atenuada'))
  })
}

// ---------- Registro y popup ----------

// ---------- Pictograma: 1 figura = 1 curso ----------
export function renderPictograma(el, spec, onPick) {
  if (!el) return
  el.classList.remove('viz-placeholder')
  el.style.padding = '0'

  const total = spec.valores.reduce((a, b) => a + b, 0)
  const filas = spec.full.map((op, i) => ({
    op, label: spec.labels[i], n: spec.valores[i], color: spec.colors[i % spec.colors.length],
  }))

  el.innerHTML = `<div class="picto-wrap">${filas.map((f, fi) => {
    const pct = total ? Math.round((f.n / total) * 100) : 0
    let figs = ''
    for (let k = 0; k < f.n; k++) figs += figuraSVG(f.color, k + fi * 3)
    return `
      <div class="picto-fila" data-op="${f.op.replace(/"/g, '&quot;')}" title="${f.label} · ${f.n} de ${total} (${pct}%)">
        <div class="picto-info">
          <span class="np" style="color:${f.color};">${f.n}</span>
          <span class="lbl">${f.label}</span>
        </div>
        <div class="picto-figs">${figs}</div>
      </div>`
  }).join('')}</div>`

  rotarIdles(el)   // las figuras se van turnando los idles

  // Clic en una fila -> abre el popup con el detalle de esa opción
  el.querySelectorAll('.picto-fila').forEach((fila) => {
    fila.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (onPick) onPick(fila.dataset.op)
    })
    fila.addEventListener('mouseenter', () => {
      el.querySelectorAll('.picto-fila').forEach((o) => { if (o !== fila) o.classList.add('apagada') })
    })
    fila.addEventListener('mouseleave', () => {
      el.querySelectorAll('.picto-fila').forEach((o) => o.classList.remove('apagada'))
    })
  })
}

// ---------- Ecosistemas: barras con siluetas ----------
export const ECO_FORMA = {
  'Humedales':        { color: '#6f9bd1', d: 'M50,2 C74,32 92,52 92,68 C92,86 73,98 50,98 C27,98 8,86 8,68 C8,52 26,32 50,2 Z' },                 // gota
  'Ríos y quebradas': { color: '#5b8fbf', d: 'M22,0 C22,18 78,26 78,44 C78,62 22,68 22,86 C22,94 26,97 30,100 L70,100 C66,97 62,94 62,86 C62,72 18,64 18,44 C18,26 62,18 62,0 Z' }, // río sinuoso
  'Páramos':          { color: '#8aa87e', d: 'M50,4 L74,52 L62,48 L84,88 L98,100 L2,100 L16,88 L38,48 L26,52 Z' },                                   // montaña
  'Cerros':           { color: '#9a8a6b', d: 'M28,26 L48,66 L58,52 L78,100 L2,100 Z M62,44 L76,20 L98,100 L70,100 Z' },                              // dos cerros
  'Embalses':         { color: '#4f92a8', d: 'M6,34 C22,26 34,42 50,42 C66,42 78,26 94,34 L94,100 L6,100 Z M6,58 C22,50 34,66 50,66 C66,66 78,50 94,58' }, // agua con ondas
  'Parques urbanos':  { color: '#6fa564', d: 'M50,2 C68,2 82,16 82,34 C82,48 73,60 60,64 L60,100 L40,100 L40,64 C27,60 18,48 18,34 C18,16 32,2 50,2 Z' }, // árbol
  'Otros':            { color: '#b0a58c', d: 'M50,6 L61,38 L95,38 L67,58 L78,92 L50,72 L22,92 L33,58 L5,38 L39,38 Z' },                              // estrella
}
const ecoForma = (nombre) => ECO_FORMA[nombre] || ECO_FORMA['Otros']

// FORMAS[x] = { color, d, accent?, accentColor? }
//   d       -> silueta rellena (obligatoria)
//   accent  -> trazo adicional SIN relleno (ondas, nervadura...), opcional
export function renderSiluetas(el, filas, FORMAS, onPick) {
  if (!el) return
  const formaDe = (nom) => FORMAS[nom] || FORMAS['Otros'] || Object.values(FORMAS)[0]
  const W = 600, H = 300, BASE = 236, TOPE = 34
  const maxN = Math.max(...filas.map((f) => f.n), 1)
  const paso = W / filas.length
  const ANCHO_SLOT = Math.min(78, paso * 0.82)   // techo de ancho por casilla (evita choques)

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <line x1="10" y1="${BASE}" x2="${W - 10}" y2="${BASE}" stroke="var(--gris-medio)" stroke-width="1" opacity=".5"/>
    ${filas.map((f, i) => {
      const cx = paso * (i + 0.5)
      const altoObjetivo = Math.max(30, (BASE - TOPE) * (f.n / maxN))   // ALTURA = valor
      const fm = formaDe(f.nombre)
      // Escala ÚNICA (misma en X e Y): el objeto crece entero, como en la realidad — nunca se deforma.
      // Si a esa escala se saldría del carril, se limita por el ancho disponible (no por el alto).
      const escala = Math.min(altoObjetivo / 100, ANCHO_SLOT / 100)
      const alto = escala * 100
      return `
        <g class="eco-g" data-eco="${esc(f.nombre)}">
          <g transform="translate(${cx.toFixed(1)}, ${(BASE - alto).toFixed(1)}) scale(${escala.toFixed(3)}) translate(-50,0)">
            <path d="${fm.d}" fill="${fm.color}"/>
            ${fm.accent ? `<path d="${fm.accent}" fill="none" stroke="${fm.accentColor || fm.color}" stroke-width="4.5" stroke-linecap="round" opacity=".8"/>` : ''}
          </g>
          <text class="eco-num" x="${cx.toFixed(1)}" y="${(BASE - alto - 7).toFixed(1)}" text-anchor="middle" fill="${fm.color}">${f.n}</text>
          <text class="eco-lbl" x="${cx.toFixed(1)}" y="${BASE + 16}" text-anchor="middle">${esc(f.label || f.nombre)}</text>
        </g>`
    }).join('')}
  </svg>`

  el.classList.add('eco-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = svg
  const total = filas.reduce((a, b) => a + b.n, 0)
  const gs = [...el.querySelectorAll('.eco-g')]
  conTooltip(el, gs, (g) => {
    const nombre = g.dataset.eco
    const f = filas.find((x) => x.nombre === nombre)
    const pct = total ? Math.round((f.n / total) * 100) : 0
    return `<span class="t">${esc(f.label || nombre)}</span><span class="v">${f.n} · ${pct}% del total</span>`
  })
  gs.forEach((g) => g.addEventListener('click', () => onPick && onPick(g.dataset.eco)))
}

// ================= RADIAL DE DEBATE (sectores) =================
// Cada categoría = un sector. El RADIO codifica el valor.
// Clic -> el sector se expande a círculo completo 3s, y el panel muestra sus datos.

// ---------- Radial de sectores ----------
const PAL_DEBATE = ['#9F574F', '#CCA782', '#90B49D', '#CCB364', '#9066CC']

export function renderRadial(el, filas, onPick, paleta = PAL_DEBATE) {
  if (!el) return
  const W = 600, H = 300, cx = W / 2, cy = H / 2 + 4
  const maxN = Math.max(...filas.map((f) => f.n), 1)
  const R_MAX = 112, R_MIN = 34
  // Radio por raíz -> el ÁREA del sector queda proporcional al dato (más honesto)
  const radioDe = (n) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(n / maxN)

  const n = filas.length
  const paso = (Math.PI * 2) / n
  const GAP = 0.045                       // separación entre sectores

  el.classList.add('radial-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg>`
  const svg = el.querySelector('svg')
  const NS = 'http://www.w3.org/2000/svg'
  const total = filas.reduce((a, b) => a + b.n, 0)

  const sectores = filas.map((f, i) => {
    const a0 = i * paso + GAP / 2, a1 = (i + 1) * paso - GAP / 2
    const r = radioDe(f.n)
    const color = PAL_DEBATE[i % PAL_DEBATE.length]

    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', 'rad-sector')

    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', arcoPath(cx, cy, r, a0, a1))
    path.setAttribute('fill', color)
    g.appendChild(path)

    // Número, a media altura del sector
    const am = (a0 + a1) / 2
    const num = document.createElementNS(NS, 'text')
    num.setAttribute('class', 'rad-num')
    num.setAttribute('x', (cx + Math.sin(am) * r * 0.62).toFixed(1))
    num.setAttribute('y', (cy - Math.cos(am) * r * 0.62 + 4).toFixed(1))
    num.setAttribute('text-anchor', 'middle')
    num.textContent = f.n
    g.appendChild(num)

    // Etiqueta afuera
    const rl = r + 16
    const lbl = document.createElementNS(NS, 'text')
    lbl.setAttribute('class', 'rad-lbl')
    lbl.setAttribute('x', (cx + Math.sin(am) * rl).toFixed(1))
    lbl.setAttribute('y', (cy - Math.cos(am) * rl + 3).toFixed(1))
    lbl.setAttribute('text-anchor', Math.sin(am) > 0.25 ? 'start' : (Math.sin(am) < -0.25 ? 'end' : 'middle'))
    lbl.textContent = f.label
    g.appendChild(lbl)

    svg.appendChild(g)
    return { ...f, g, path, num, lbl, a0, a1, r, color }
  })

  let timer = null
  sectores.forEach((s2) => {
    s2.g.addEventListener('mouseenter', () => {
      el.classList.add('atenuado'); s2.g.classList.add('activo')
    })
    s2.g.addEventListener('mouseleave', () => {
      el.classList.remove('atenuado')
      // no quitamos 'activo' si está expandido: lo maneja el clic
      if (!s2.g.dataset.exp) s2.g.classList.remove('activo')
    })

    s2.g.addEventListener('click', () => {
      // El panel se actualiza SIEMPRE (y no se cierra al colapsar)
      if (onPick) onPick(s2.op)

      if (timer) clearTimeout(timer)
      // Reiniciar cualquier expansión previa
      sectores.forEach((o) => {
        delete o.g.dataset.exp
        o.g.classList.remove('activo')
        o.path.setAttribute('d', arcoPath(cx, cy, o.r, o.a0, o.a1))
        o.num.style.opacity = 1
        o.lbl.style.opacity = 1
      })

      // Expandir ESTE a círculo completo
      s2.g.dataset.exp = '1'
      s2.g.classList.add('activo')
      svg.appendChild(s2.g)                       // al frente
      s2.path.setAttribute('d', arcoPath(cx, cy, R_MAX + 14, 0, Math.PI * 2))
      s2.num.setAttribute('x', cx)
      s2.num.setAttribute('y', cy + 5)
      s2.lbl.style.opacity = 0

      // A los 3 s vuelve al tamaño normal — el panel SIGUE mostrando los datos
      timer = setTimeout(() => {
        delete s2.g.dataset.exp
        s2.g.classList.remove('activo')
        s2.path.setAttribute('d', arcoPath(cx, cy, s2.r, s2.a0, s2.a1))
        const am = (s2.a0 + s2.a1) / 2
        s2.num.setAttribute('x', (cx + Math.sin(am) * s2.r * 0.62).toFixed(1))
        s2.num.setAttribute('y', (cy - Math.cos(am) * s2.r * 0.62 + 4).toFixed(1))
        s2.lbl.style.opacity = 1
      }, 3000)
    })
  })
}

// ================= Texto verde desplegable =================

// ---------- Blobs (participación) ----------
export const PAL_BLOB = ['#c9748f', '#d98f62', '#a385c9', '#6f9bd1', '#6bb3a4']

export function rankNivel(k) {
  const t = norm(k)
  if (t.includes('no part')) return 0
  if (t.includes('muy') && t.includes('baj')) return 0
  if (t.includes('present') || t.includes('baj')) return 1
  if (t.includes('atent') || t.includes('medi')) return 2
  if (t.includes('muy') && t.includes('alt')) return 4
  if (t.includes('activ')) return 4
  if (t.includes('intervin') || t.includes('algunos') || t.includes('alt')) return 3
  return 2
}

// Ruido tipo Perlin (2D) — escrito a mano para no depender de otra librería



// Ecosistemas = siluetas con el mapa de formas de arriba (se conserva igual)
export const renderEcosistemas = (el, filas, onPick) => renderSiluetas(el, filas, ECO_FORMA, onPick)

// ---------- Formas de comunicar: siluetas propias ----------
export const COMUNICAR_FORMA = {
  'Audiovisual': { color: '#9F574F', d: 'M8,22 L60,22 A6,6 0 0 1 66,28 L66,44 L92,26 L92,80 L66,62 L66,78 A6,6 0 0 1 60,84 L8,84 A6,6 0 0 1 2,78 L2,28 A6,6 0 0 1 8,22 Z' },   // cámara
  'Sonoro':      { color: '#CCA782', d: 'M50,2 A14,14 0 0 1 64,16 L64,50 A14,14 0 0 1 36,50 L36,16 A14,14 0 0 1 50,2 Z M18,44 L26,44 A24,24 0 0 0 74,44 L82,44 A32,32 0 0 1 54,75 L54,92 L46,92 L46,75 A32,32 0 0 1 18,44 Z' }, // micrófono
  'Gráfico':     { color: '#90B49D', d: 'M74,2 L96,24 L40,80 L12,88 L20,60 Z M14,92 L34,84 L26,98 Z' },   // pincel
}

// ---------- Blobs genéricos (reusa el ruido + spline) ----------
// filas: [{ op, label, n, color }]
// Blobs orgánicos con FÍSICA: el mouse los empuja, chocan entre ellos,
// y a los 3s sin interacción vuelven solos a su lugar original.
export function renderBlobs(el, filas, onPick) {
  if (!el) return
  const TOTAL = filas.reduce((a, b) => a + b.n, 0)
  const maxN  = Math.max(...filas.map((d) => d.n), 1)
  const VW = 600, VH = 260

  el.classList.add('blobs-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet"></svg>`
  const svg = el.querySelector('svg')

  const R_MAX = 58, R_MIN = 20
  const radioDe = (n) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(n / maxN)   // ÁREA proporcional
  const paso = VW / filas.length
  const ruido = crearRuido()
  const NP = 8

  const blobs = filas.map((d, i) => {
    const cx0 = paso * (i + 0.5), cy0 = 130, rad = radioDe(d.n)
    const pts = []
    for (let k = 0; k < NP; k++) {
      const th = (k / NP) * Math.PI * 2
      // rx/ry: posición del punto RELATIVA al centro (fija). El centro se mueve con la física;
      // los puntos lo siguen en bloque y el ruido sigue deformando el contorno encima.
      pts.push({ rx: Math.cos(th) * rad, ry: Math.sin(th) * rad, x: cx0, y: cy0,
                 nx: Math.random() * 1000, ny: Math.random() * 1000 })
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'blob-path'); path.setAttribute('fill', d.color)
    path.dataset.op = d.op
    svg.appendChild(path)
    return { ...d, pts, path, rad, amp: rad * 0.15, vel: 0.0035,
             cx0, cy0, ox: 0, oy: 0 }   // (ox,oy) = desplazamiento actual por física
  })

  conTooltip(el, blobs.map((b) => b.path), (n) => {
    const b = blobs.find((x) => x.path === n)
    const pct = TOTAL ? Math.round((b.n / TOTAL) * 100) : 0
    return `<span class="t">${esc(b.label)}</span><span class="v">${b.n} · ${pct}% del total</span>`
  })
  blobs.forEach((b) => {
    b.path.addEventListener('mouseenter', () => { b.vel = 0.009 })   // se agita más
    b.path.addEventListener('mouseleave', () => { b.vel = 0.0035 })
    b.path.addEventListener('click', () => onPick && onPick(b.op))
  })

  // ---------- Leyenda debajo (CON números) ----------
  const prev = el.parentElement.querySelector('.blob-leyenda')
  if (prev) prev.remove()
  const ley = document.createElement('div')
  ley.className = 'blob-leyenda'
  ley.innerHTML = filas.map((d) =>
    `<span class="blob-leg"><span class="sw" style="background:${d.color}"></span>${esc(d.label)} <b>${d.n}</b></span>`).join('')
  el.insertAdjacentElement('afterend', ley)

  // ---------- Física: el mouse empuja, los blobs chocan, y vuelven solos ----------
  let mouse = null            // {x,y} en coords del viewBox, o null si el mouse no está encima
  let ultimoEmpuje = 0
  const EMPUJE_RADIO = 90, EMPUJE_FUERZA = 5.5, MAX_OFFSET = 78

  function aCoordsSVG(ev) {
    const r = el.getBoundingClientRect()
    return { x: (ev.clientX - r.left) / r.width * VW, y: (ev.clientY - r.top) / r.height * VH }
  }
  el.addEventListener('mousemove', (ev) => { mouse = aCoordsSVG(ev); ultimoEmpuje = performance.now() })
  el.addEventListener('mouseleave', () => { mouse = null })

  const map = (n, a, b, c, d2) => ((n - a) / (b - a)) * (d2 - c) + c
  ;(function animar() {
    if (!el.isConnected) return
    const ahora = performance.now()
    const quieto = ahora - ultimoEmpuje > 3000   // 3s sin interacción -> vuelven a casa

    // 1) Empuje del mouse
    if (mouse) {
      for (const b of blobs) {
        const cx = b.cx0 + b.ox, cy = b.cy0 + b.oy
        const dx = cx - mouse.x, dy = cy - mouse.y
        const dist = Math.hypot(dx, dy) || 0.001
        const alcance = EMPUJE_RADIO + b.rad
        if (dist < alcance) {
          const fuerza = (1 - dist / alcance) * EMPUJE_FUERZA
          b.ox += (dx / dist) * fuerza
          b.oy += (dy / dist) * fuerza
        }
      }
    }

    // 2) Colisión entre blobs: si se encima, se separan
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const A = blobs[i], B = blobs[j]
        const ax = A.cx0 + A.ox, ay = A.cy0 + A.oy
        const bx = B.cx0 + B.ox, by = B.cy0 + B.oy
        const dx = bx - ax, dy = by - ay
        const dist = Math.hypot(dx, dy) || 0.001
        const minDist = (A.rad + B.rad) * 0.88
        if (dist < minDist) {
          const solape = (minDist - dist) / 2
          const nx = dx / dist, ny = dy / dist
          A.ox -= nx * solape; A.oy -= ny * solape
          B.ox += nx * solape; B.oy += ny * solape
        }
      }
    }

    // 3) Límite de desplazamiento + regreso a casa tras 3s quieto
    for (const b of blobs) {
      const d = Math.hypot(b.ox, b.oy)
      if (d > MAX_OFFSET) { b.ox = (b.ox / d) * MAX_OFFSET; b.oy = (b.oy / d) * MAX_OFFSET }
      if (quieto) { b.ox *= 0.92; b.oy *= 0.92 }
    }

    // 4) Redibujar (centro = base + física; contorno = física + ruido)
    for (const b of blobs) {
      const cx = b.cx0 + b.ox, cy = b.cy0 + b.oy
      for (const pt of b.pts) {
        const ox = cx + pt.rx, oy = cy + pt.ry
        pt.x = map(ruido(pt.nx, pt.nx), -1, 1, ox - b.amp, ox + b.amp)
        pt.y = map(ruido(pt.ny, pt.ny), -1, 1, oy - b.amp, oy + b.amp)
        pt.nx += b.vel; pt.ny += b.vel
      }
      b.path.setAttribute('d', spline(b.pts))
    }
    requestAnimationFrame(animar)
  })()
}

// ---------- FLUJO: cintas orgánicas a través de las fases ----------
// Muestra cómo cambia la distribución entre Fase 1 -> 2 -> 3.
// series: [{ op, label, color, valores:[n1,n2,n3] }], etapas: ['Fase 1', ...]
// Cintas de flujo. El mouse hace que las fronteras onduleen —
// pero SIEMPRE se desplaza la MISMA cantidad a todas las bandas en esa
// misma coordenada X, así el grosor (la proporción) de cada banda nunca cambia.
export function renderFlujo(el, series, etapas, onPick) {
  if (!el) return
  const W = 600, H = 300, PAD_X = 58, PAD_T = 26, PAD_B = 44
  const nE = etapas.length
  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / (nE - 1)

  const totales = etapas.map((_, i) => series.reduce((a, s) => a + s.valores[i], 0) || 1)
  const alto = H - PAD_T - PAD_B

  // Fronteras BASE (inmutables): frontera[0] = línea de piso (0%), frontera[k] = techo acumulado
  const fronteras = []   // fronteras[k][i] = {x,y} — k-ésima frontera, en la etapa i
  for (let k = 0; k <= series.length; k++) {
    const fila = []
    for (let i = 0; i < nE; i++) {
      const acum = series.slice(0, k).reduce((a, s) => a + s.valores[i], 0)
      fila.push({ x: x(i), y: PAD_T + (acum / totales[i]) * alto })
    }
    fronteras.push(fila)
  }

  const curva = (pts) => pts.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`
    const a = pts[i - 1], mx = (a.x + p.x) / 2
    return ` C ${mx.toFixed(1)},${a.y.toFixed(1)} ${mx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join('')

  el.classList.add('flujo-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${series.map((s, k) => `<path class="flujo-cinta" data-op="${esc(s.op)}" fill="${s.color}"/>`).join('')}
    ${etapas.map((e, i) => `<text class="flujo-eje" x="${x(i).toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(e)}</text>`).join('')}
  </svg>`

  const svg = el.querySelector('svg')
  const rutas = [...svg.querySelectorAll('.flujo-cinta')]

  // ---------- Onda: desplaza cada frontera por igual en cada X (no cambia grosores) ----------
  let mouseX = null, activo = false, t = 0
  const ola = new Array(nE).fill(0)      // amplitud actual por etapa (se suaviza hacia el objetivo)

  function pintar() {
    for (let k = 0; k < series.length; k++) {
      const sup = fronteras[k].map((p, i) => ({ x: p.x, y: p.y + ola[i] }))
      const inf = fronteras[k + 1].map((p, i) => ({ x: p.x, y: p.y + ola[i] }))
      const d = curva(sup) + ' L' + curva(inf.slice().reverse()).slice(1) + ' Z'
      rutas[k].setAttribute('d', d)
    }
  }
  pintar()

  el.addEventListener('mousemove', (ev) => {
    const r = el.getBoundingClientRect()
    mouseX = (ev.clientX - r.left) / r.width * W
    activo = true
  })
  el.addEventListener('mouseleave', () => { activo = false; mouseX = null })

  ;(function animar() {
    if (!el.isConnected) return
    t += 0.05
    for (let i = 0; i < nE; i++) {
      const influencia = (activo && mouseX != null) ? Math.max(0, 1 - Math.abs(mouseX - x(i)) / 150) : 0
      const objetivo = Math.sin(t + i * 0.9) * 9 * influencia
      ola[i] += (objetivo - ola[i]) * 0.12          // suaviza el movimiento (sin perder proporción)
    }
    pintar()
    requestAnimationFrame(animar)
  })()

  conTooltip(el, rutas, (n) => {
    const s2 = series.find((x2) => x2.op === n.dataset.op)
    const det = s2.valores.map((v, i) => `${etapas[i]}: ${v}`).join(' · ')
    return `<span class="t">${esc(s2.label)}</span><span class="v">${det}</span>`
  })
  rutas.forEach((c) => c.addEventListener('click', () => onPick && onPick(c.dataset.op)))

  const prev = el.parentElement.querySelector('.blob-leyenda')
  if (prev) prev.remove()
  const ley = document.createElement('div')
  ley.className = 'blob-leyenda'
  ley.innerHTML = series.map((s) =>
    `<span class="blob-leg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join('')
  el.insertAdjacentElement('afterend', ley)
}

// ---------- HOJAS: dos categorías enfrentadas ----------
// filas: [{ op, label, n, color }] — pensado para 2, funciona con más.
export const LEAF_D = 'M50,2 C82,20 96,52 84,78 C74,98 56,100 50,98 C44,100 26,98 16,78 C4,52 18,20 50,2 Z'
export const LEAF_VEIN_D = 'M50,10 L50,96'

export function renderHojas(el, filas, onPick) {
  if (!el) return
  const W = 600, H = 300, cy = 150
  const total = filas.reduce((a, b) => a + b.n, 0) || 1
  const maxN = Math.max(...filas.map((f) => f.n), 1)
  const paso = W / filas.length
  const ESC_MAX = 1.0, ESC_MIN = 0.5
  const escala = (n) => ESC_MIN + (ESC_MAX - ESC_MIN) * Math.sqrt(n / maxN)

  const HOJA = LEAF_D, NERV = LEAF_VEIN_D

  el.classList.add('hojas-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${filas.map((f, i) => {
      const cx = paso * (i + 0.5)
      const k = escala(f.n) * 118
      const pct = Math.round((f.n / total) * 100)
      const rot = (i % 2 === 0) ? -8 : 8
      return `
        <g class="hoja-g" data-op="${esc(f.op)}">
          <g transform="translate(${cx.toFixed(1)}, ${cy}) rotate(${rot}) scale(${(k/100).toFixed(3)}) translate(-50,-50)">
            <path d="${HOJA}" fill="${f.color}"/>
            <path d="${NERV}" stroke="rgba(255,255,255,.45)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          </g>
          <text class="hoja-num" x="${cx.toFixed(1)}" y="${cy + 5}" text-anchor="middle">${pct}%</text>
          <text class="hoja-lbl" x="${cx.toFixed(1)}" y="${H - 24}" text-anchor="middle">${esc(f.label)}</text>
          <text class="hoja-sub" x="${cx.toFixed(1)}" y="${H - 11}" text-anchor="middle">${f.n} registros</text>
        </g>`
    }).join('')}
  </svg>`

  const gs = [...el.querySelectorAll('.hoja-g')]
  conTooltip(el, gs, (n) => {
    const f = filas.find((x) => x.op === n.dataset.op)
    const pct = Math.round((f.n / total) * 100)
    return `<span class="t">${esc(f.label)}</span><span class="v">${f.n} · ${pct}% del total</span>`
  })
  gs.forEach((g) => g.addEventListener('click', () => onPick && onPick(g.dataset.op)))
}

// ============================================================
//  PROBLEMA_FORMA — siluetas para "Problemáticas ambientales"
//  (mismo mecanismo que ECO_FORMA: un icono propio por categoría)
// ============================================================
export const PROBLEMA_FORMA = {
  agua: {          // contaminación del agua -> gota "turbia"
    color: '#7a6a44',
    d: ECO_FORMA['Humedales'].d,
  },
  escasez: {        // escasez de agua -> gota incompleta (cortada)
    color: '#cf9f4e',
    d: 'M50,2 C74,32 92,52 92,68 L8,68 C8,52 26,32 50,2 Z',
  },
  biodiversidad: {  // pérdida de biodiversidad -> hoja
    color: '#6fa564',
    d: LEAF_D,
    accent: LEAF_VEIN_D,
    accentColor: 'rgba(255,255,255,.5)',
  },
  residuos: {       // generación de residuos -> montón
    color: '#8a7d6b',
    d: 'M10,98 C10,70 30,40 50,40 C70,40 90,70 90,98 Z M30,90 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M62,88 a3.4,3.4 0 1,0 6.8,0 a3.4,3.4 0 1,0 -6.8,0',
  },
  ruido: {          // ruido -> altavoz + ondas de sonido
    color: '#9066CC',
    d: 'M18,38 L36,38 L58,18 L58,82 L36,62 L18,62 Z',
    accent: 'M66,34 A20,20 0 0 1 66,66 M78,22 A34,34 0 0 1 78,78',
    accentColor: '#9066CC',
  },
  otro: {           // otro -> estrella (mismo lenguaje visual que "Otros" en ecosistemas)
    color: '#b0a58c',
    d: ECO_FORMA['Otros'].d,
  },
}
// Clasifica el texto largo de la opción en una de las 6 categorías de arriba
export function categoriaProblema(texto) {
  const t = norm(texto)
  if (t.includes('escasez')) return 'escasez'          // revisar ANTES que "agua" (más específico)
  if (t.includes('agua')) return 'agua'
  if (t.includes('biodiversidad')) return 'biodiversidad'
  if (t.includes('residuo')) return 'residuos'
  if (t.includes('ruido')) return 'ruido'
  return 'otro'
}

// ============================================================
//  PÉTALOS — diagrama tipo "rosa de Nightingale", pero con pétalos
//  orgánicos en vez de cuñas rectas. El LARGO del pétalo = el valor
//  (√, área justa). Escala uniforme -> nunca se deforma.
// ============================================================
export function renderPetalos(el, filas, onPick) {
  if (!el) return
  const W = 600, H = 300, cx = W / 2, cy = H / 2 + 6
  const maxN = Math.max(...filas.map((f) => f.n), 1)
  const n = filas.length
  const angPaso = (Math.PI * 2) / n
  const R_MAX = 116, R_MIN = 42
  const largoDe = (v) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(v / maxN)
  const total = filas.reduce((a, b) => a + b.n, 0)

  // Pétalo unitario: base en (0,0), punta en (0,-1). Ancho de control = w.
  const w = 0.3
  const petaloD = `M0,0 C${w},-0.16 ${w * 0.86},-0.86 0,-1 C${-w * 0.86},-0.86 ${-w},-0.16 0,0 Z`

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${filas.map((f, i) => {
      const ang = i * angPaso
      const largo = largoDe(f.n)
      const deg = (ang * 180 / Math.PI).toFixed(1)
      return `<g class="petalo-g" data-op="${esc(f.op)}" transform="translate(${cx},${cy}) rotate(${deg})">
        <path class="petalo-path" d="${petaloD}" fill="${f.color}" transform="scale(${largo.toFixed(1)})"/>
      </g>`
    }).join('')}
    <circle cx="${cx}" cy="${cy}" r="19" class="petalo-centro"/>
  </svg>`

  el.classList.add('petalo-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = svg
  const gs = [...el.querySelectorAll('.petalo-g')]
  conTooltip(el, gs, (g) => {
    const f = filas.find((x) => x.op === g.dataset.op)
    const pct = total ? Math.round((f.n / total) * 100) : 0
    return `<span class="t">${esc(f.label)}</span><span class="v">${f.n} · ${pct}% del total</span>`
  })
  gs.forEach((g) => g.addEventListener('click', () => onPick && onPick(g.dataset.op)))

  const prev = el.parentElement.querySelector('.blob-leyenda')
  if (prev) prev.remove()
  const ley = document.createElement('div')
  ley.className = 'blob-leyenda'
  ley.innerHTML = filas.map((f) =>
    `<span class="blob-leg"><span class="sw" style="background:${f.color}"></span>${esc(f.label)} <b>${f.n}</b></span>`).join('')
  el.insertAdjacentElement('afterend', ley)
}

// ============================================================
//  ÓRBITAS — públicos objetivos como planetas orbitando el proyecto.
//  Órbita más CERCANA = público más mencionado. Los puntos giran solos;
//  el tamaño del punto también refleja el valor.
// ============================================================
export function renderOrbitas(el, filas, onPick) {
  if (!el) return
  const W = 600, H = 300, cx = W / 2, cy = H / 2 + 2
  const total = filas.reduce((a, b) => a + b.n, 0) || 1
  const orden = filas.slice().sort((a, b) => b.n - a.n)
  const maxN = Math.max(...orden.map((f) => f.n), 1)
  const R_MIN = 44, R_STEP = 27

  const NS = 'http://www.w3.org/2000/svg'
  el.classList.add('orbita-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg>`
  const svg = el.querySelector('svg')

  orden.forEach((f, i) => {
    const r = R_MIN + i * R_STEP
    const anillo = document.createElementNS(NS, 'circle')
    anillo.setAttribute('class', 'orbita-anillo')
    anillo.setAttribute('cx', cx); anillo.setAttribute('cy', cy); anillo.setAttribute('r', r)
    svg.appendChild(anillo)
  })

  const centro = document.createElementNS(NS, 'circle')
  centro.setAttribute('class', 'orbita-sol'); centro.setAttribute('cx', cx); centro.setAttribute('cy', cy); centro.setAttribute('r', 20)
  svg.appendChild(centro)
  const txtSol = document.createElementNS(NS, 'text')
  txtSol.setAttribute('class', 'orbita-sol-txt'); txtSol.setAttribute('x', cx); txtSol.setAttribute('y', cy + 4); txtSol.setAttribute('text-anchor', 'middle')
  txtSol.textContent = 'Productos'
  svg.appendChild(txtSol)

  const puntos = orden.map((f, i) => {
    const r = R_MIN + i * R_STEP
    const radioPunto = 7 + 12 * Math.sqrt(f.n / maxN)
    const angIni = (i * 61 + 15) % 360
    const dur = (22 + i * 7).toFixed(1)

    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', 'orbita-g')
    g.setAttribute('data-op', f.op)
    const anim = document.createElementNS(NS, 'animateTransform')
    anim.setAttribute('attributeName', 'transform')
    anim.setAttribute('type', 'rotate')
    anim.setAttribute('from', `${angIni} ${cx} ${cy}`)
    anim.setAttribute('to', `${angIni + 360} ${cx} ${cy}`)
    anim.setAttribute('dur', `${dur}s`)
    anim.setAttribute('repeatCount', 'indefinite')
    g.appendChild(anim)

    const punto = document.createElementNS(NS, 'circle')
    punto.setAttribute('class', 'orbita-punto')
    punto.setAttribute('cx', cx + r); punto.setAttribute('cy', cy); punto.setAttribute('r', radioPunto.toFixed(1))
    punto.setAttribute('fill', f.color)
    g.appendChild(punto)
    svg.appendChild(g)
    return { ...f, g, punto }
  })

  conTooltip(el, puntos.map((p) => p.punto), (n) => {
    const p = puntos.find((x) => x.punto === n)
    const pct = Math.round((p.n / total) * 100)
    return `<span class="t">${esc(p.label)}</span><span class="v">${p.n} · ${pct}% del total</span>`
  })
  puntos.forEach((p) => p.punto.addEventListener('click', () => onPick && onPick(p.op)))

  const prev = el.parentElement.querySelector('.blob-leyenda')
  if (prev) prev.remove()
  const ley = document.createElement('div')
  ley.className = 'blob-leyenda'
  ley.innerHTML = orden.map((f) =>
    `<span class="blob-leg"><span class="sw" style="background:${f.color}"></span>${esc(f.label)} <b>${f.n}</b></span>`).join('')
  el.insertAdjacentElement('afterend', ley)
}

// ============================================================
//  LLUVIA DE HOJAS — dos categorías, cada una un blob con el %
//  adentro, y una lluvia de hojitas cayendo cuya CANTIDAD depende
//  del porcentaje (más mencionada = cae más).
// ============================================================
export function renderLluviaHojas(el, filas, onPick) {
  if (!el) return
  const total = filas.reduce((a, b) => a + b.n, 0) || 1

  el.classList.add('lluvia-box'); el.classList.remove('viz-placeholder')
  el.innerHTML = `<div class="lluvia-wrap">${filas.map((f) => {
    const pct = Math.round((f.n / total) * 100)
    const nHojas = Math.max(3, Math.min(24, Math.round(pct / 4)))
    let hojas = ''
    for (let k = 0; k < nHojas; k++) {
      const left = (Math.random() * 82 + 6).toFixed(1)
      const dur = (3.2 + Math.random() * 2.8).toFixed(2)
      const delay = (-Math.random() * 6).toFixed(2)
      const tam = (7 + Math.random() * 7).toFixed(1)
      const rot = Math.round(Math.random() * 360)
      hojas += `<span class="hoja-cae" style="left:${left}%;--dur:${dur}s;--delay:${delay}s;--tam:${tam}px;--rot0:${rot}deg;background:${f.color}"></span>`
    }
    return `
      <div class="lluvia-mitad" data-op="${esc(f.op)}">
        <div class="lluvia-cielo">${hojas}</div>
        <div class="lluvia-blob" style="background:${f.color}"><span class="lluvia-pct">${pct}%</span></div>
        <div class="lluvia-lbl">${esc(f.label)}<br><span class="lluvia-n">${f.n} productos</span></div>
      </div>`
  }).join('')}</div>`

  el.querySelectorAll('.lluvia-mitad').forEach((m) =>
    m.addEventListener('click', () => onPick && onPick(m.dataset.op)))
}