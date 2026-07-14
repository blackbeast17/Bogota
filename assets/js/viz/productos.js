// ============================================================
//  viz-productos.js — Individual (ortográfica) <-> Red (equirectangular)
//  + zoom/pan + al acercarte, el círculo se convierte en una
//    mini-tarjeta con el video/audio real (iframe bajo demanda).
//
//  Usa el mismo truco del notebook de Bostock (orthographic-to-
//  equirectangular): una función "raw" que mezcla las salidas de
//  dos proyecciones para un mismo punto (lon,lat). Las coordenadas
//  no son geográficas reales — cada producto recibe una posición
//  simbólica según su ecosistema — pero la mecánica de proyección
//  y de zoom es real, escrita a mano (sin D3, sin dependencias).
//
//  Lee las tarjetas .producto-item que YA existen en el DOM, así
//  que escala con solo agregar más tarjetas al HTML.
// ============================================================
(function () {
  const items = [...document.querySelectorAll('#productos-container .producto-item')]
  const cont = document.getElementById('viz-productos-red')
  if (!items.length || !cont) return

  const PAL_ECO = { humedal: '#6f9bd1', paramo: '#8aa87e', rio: '#5b8fbf', cerro: '#9a8a6b', embalse: '#4f92a8', parque: '#6fa564' }
  const LBL_ECO = { humedal: 'Humedal', paramo: 'Páramo', rio: 'Río', cerro: 'Cerro', embalse: 'Embalse', parque: 'Parque urbano' }
  const colorEco = (e) => PAL_ECO[e] || '#b0a58c'
  const labelEco = (e) => LBL_ECO[e] || (e ? e.charAt(0).toUpperCase() + e.slice(1) : 'Otro')
  const esc = (s) => (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // ---------- 1) Leer los nodos desde el DOM ----------
  const NODES = items.map((el, i) => {
    const card = el.querySelector('.card-producto')
    return {
      id: card?.dataset.id || ('p' + i), el, card,
      titulo: card?.dataset.titulo || el.querySelector('.card-header')?.textContent?.trim() || 'Producto',
      eco: el.dataset.ecosistema || 'otro',
      formato: el.dataset.formato || '', colegio: el.dataset.colegio || '',
      localidad: el.dataset.localidad || '', grado: el.dataset.grado || '',
      kind: card?.dataset.kind || 'youtube', vid: card?.dataset.vid || '',
      poster: card?.querySelector('.media-poster')?.getAttribute('src') || '',
    }
  })
  if (NODES.length < 2) return

  // ---------- 2) Coordenadas simbólicas (lon, lat en radianes) ----------
  const grupos = {}
  NODES.forEach((n) => { (grupos[n.eco] = grupos[n.eco] || []).push(n) })
  const ecos = Object.keys(grupos)
  const LMAX = 65 * Math.PI / 180
  const PMAX = 42 * Math.PI / 180

  ecos.forEach((eco, gi) => {
    const lonCentro = ecos.length > 1 ? (-LMAX * 0.72) + (gi / (ecos.length - 1)) * (LMAX * 1.44) : 0
    const grupo = grupos[eco]
    grupo.forEach((n, k) => {
      const t = grupo.length > 1 ? (k / (grupo.length - 1) - 0.5) : 0
      n.lon = lonCentro + t * (LMAX * 0.30)
      n.lat = (((k * 41) % 5) / 5 - 0.5) * PMAX * 0.85
    })
  })

  // ---------- 3) Las dos proyecciones + su mezcla ----------
  const orthoRaw = (lon, lat) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const equiRaw  = (lon, lat) => [lon / LMAX, lat / PMAX]
  const rawBlend = (lon, lat, a) => {
    const po = orthoRaw(lon, lat), pe = equiRaw(lon, lat)
    return [po[0] * (1 - a) + pe[0] * a, po[1] * (1 - a) + pe[1] * a]
  }

  const W = 380, H = 300, cx = W / 2, cy = H / 2 + 6, R = 118
  const proyectar = (lon, lat, a) => {
    const [x, y] = rawBlend(lon, lat, a)
    return [cx + x * R, cy - y * R]
  }

  // ---------- 4) "Esfera" (perímetro del dominio) y gratícula ----------
  function perimetro() {
    const pts = [], N = 24
    for (let i = 0; i <= N; i++) pts.push([-LMAX + (2 * LMAX) * (i / N), -PMAX])
    for (let i = 0; i <= N; i++) pts.push([LMAX, -PMAX + (2 * PMAX) * (i / N)])
    for (let i = 0; i <= N; i++) pts.push([LMAX - (2 * LMAX) * (i / N), PMAX])
    for (let i = 0; i <= N; i++) pts.push([-LMAX, PMAX - (2 * PMAX) * (i / N)])
    return pts
  }
  const PERIM = perimetro()
  const MERIDIANOS = []
  for (let d = -60; d <= 60; d += 30) {
    const lon = d * Math.PI / 180, pts = []
    for (let i = 0; i <= 20; i++) pts.push([lon, -PMAX + (2 * PMAX) * (i / 20)])
    MERIDIANOS.push(pts)
  }
  const PARALELOS = []
  for (let d = -30; d <= 30; d += 30) {
    const lat = d * Math.PI / 180, pts = []
    for (let i = 0; i <= 20; i++) pts.push([-LMAX + (2 * LMAX) * (i / 20), lat])
    PARALELOS.push(pts)
  }
  const GRATICULA = [...MERIDIANOS, ...PARALELOS]

  // ---------- 5) Conexiones entre productos ----------
  // Orden de prioridad: colegio > formato > grado (todas "fuertes" si cruzan
  // ecosistema) > localidad (más débil, es un criterio más amplio).
  const EDGES = []
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const A = NODES[i], B = NODES[j]
      const cruza = A.eco !== B.eco
      if (!cruza) { EDGES.push({ a: A, b: B, tipo: 'cluster' }); continue }
      if (A.colegio && A.colegio === B.colegio) { EDGES.push({ a: A, b: B, tipo: 'fuerte', why: 'mismo colegio' }); continue }
      if (A.formato && A.formato === B.formato) { EDGES.push({ a: A, b: B, tipo: 'fuerte', why: 'mismo formato' }); continue }
      if (A.grado && A.grado === B.grado) { EDGES.push({ a: A, b: B, tipo: 'fuerte', why: 'mismo grado (' + A.grado + '°)' }); continue }
      if (A.localidad && A.localidad === B.localidad) EDGES.push({ a: A, b: B, tipo: 'localidad', why: 'misma localidad' })
    }
  }
  const ESTILO = { cluster: { width: 0.6, op: 0.12 }, localidad: { width: 1.0, op: 0.38 }, fuerte: { width: 1.8, op: 0.62 } }

  // ---------- 6) Dibujar ----------
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  cont.appendChild(svg)

  const zoomG = document.createElementNS(NS, 'g')
  svg.appendChild(zoomG)

  const pathPerim = document.createElementNS(NS, 'path')
  pathPerim.setAttribute('fill', '#fff'); pathPerim.setAttribute('stroke', '#a89f8c'); pathPerim.setAttribute('stroke-width', '1')
  zoomG.appendChild(pathPerim)

  const gratEls = GRATICULA.map(() => {
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#ddd6c4'); p.setAttribute('stroke-width', '0.6')
    zoomG.appendChild(p)
    return p
  })

  const lineEls = EDGES.map((e) => {
    const l = document.createElementNS(NS, 'line')
    l.setAttribute('stroke', '#54461E'); l.setAttribute('stroke-width', ESTILO[e.tipo].width)
    zoomG.appendChild(l)
    return l
  })

  function irACard(n) {
    n.el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    n.card?.classList.remove('vp-highlight')
    void n.card?.offsetWidth
    n.card?.classList.add('vp-highlight')
    setTimeout(() => n.card?.classList.remove('vp-highlight'), 1500)
  }

  const nodeEls = NODES.map((n) => {
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', 'vp-node')
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('r', '6.5'); c.setAttribute('fill', colorEco(n.eco))
    const t = document.createElementNS(NS, 'title')
    t.textContent = n.titulo + ' — ' + labelEco(n.eco)
    g.appendChild(c); g.appendChild(t)
    g.addEventListener('click', () => irACard(n))
    zoomG.appendChild(g)
    return g
  })

  const cerrado = (pts, a) => 'M' + pts.map(([lo, la]) => proyectar(lo, la, a).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'
  const abierto = (pts, a) => 'M' + pts.map(([lo, la]) => proyectar(lo, la, a).map((v) => v.toFixed(1)).join(',')).join('L')

  function render(a) {
    pathPerim.setAttribute('d', cerrado(PERIM, a))
    gratEls.forEach((p, i) => p.setAttribute('d', abierto(GRATICULA[i], a)))
    NODES.forEach((n) => { const [x, y] = proyectar(n.lon, n.lat, a); n.x = x; n.y = y })
    nodeEls.forEach((g, i) => g.setAttribute('transform', `translate(${NODES[i].x.toFixed(1)},${NODES[i].y.toFixed(1)})`))
    lineEls.forEach((l, i) => {
      const e = EDGES[i]
      l.setAttribute('x1', e.a.x.toFixed(1)); l.setAttribute('y1', e.a.y.toFixed(1))
      l.setAttribute('x2', e.b.x.toFixed(1)); l.setAttribute('y2', e.b.y.toFixed(1))
      l.setAttribute('opacity', (ESTILO[e.tipo].op * a).toFixed(2))
    })
    document.getElementById('vp-modo').textContent = a < 0.5 ? 'Individual (ortográfica)' : 'Red (equirectangular)'
    posicionarFO()
  }

  // ---------- 7) Leyenda ----------
  const ley = document.getElementById('viz-productos-leyenda')
  ley.innerHTML = ecos.map((e) => `<span><span class="dot" style="background:${colorEco(e)}"></span>${labelEco(e)}</span>`).join('')

  // ---------- 8) ZOOM / PAN (a mano, sin librerías) ----------
  let tx = 0, ty = 0, k = 1
  const K_MIN = 1, K_MAX = 6, UMBRAL_EXPANDIR = 2.3
  function aplicarTransform() { zoomG.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`) }

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const rect = svg.getBoundingClientRect()
    const px = (ev.clientX - rect.left) / rect.width * W
    const py = (ev.clientY - rect.top) / rect.height * H
    const factor = Math.exp(-ev.deltaY * 0.0015)
    const nk = Math.max(K_MIN, Math.min(K_MAX, k * factor))
    tx = px - (px - tx) * (nk / k)
    ty = py - (py - ty) * (nk / k)
    k = nk
    aplicarTransform()
    actualizarExpansion()
  }, { passive: false })

  let arrastrando = false, lastX = 0, lastY = 0
  svg.addEventListener('mousedown', (ev) => { arrastrando = true; lastX = ev.clientX; lastY = ev.clientY })
  window.addEventListener('mousemove', (ev) => {
    if (!arrastrando) return
    const rect = svg.getBoundingClientRect()
    tx += (ev.clientX - lastX) / rect.width * W
    ty += (ev.clientY - lastY) / rect.height * H
    lastX = ev.clientX; lastY = ev.clientY
    aplicarTransform()
    actualizarExpansion()
  })
  window.addEventListener('mouseup', () => { arrastrando = false })
  svg.addEventListener('dblclick', () => { tx = 0; ty = 0; k = 1; aplicarTransform(); colapsar() })

  // ---------- 9) Al acercarte lo suficiente, el círculo -> mini-tarjeta ----------
  let expandido = null, foEl = null

  function colapsar() {
    if (!expandido) return
    if (foEl) { foEl.remove(); foEl = null }
    const idx = NODES.indexOf(expandido)
    if (idx >= 0) nodeEls[idx].style.display = ''
    expandido = null
  }

  function posicionarFO() {
    if (!foEl || !expandido) return
    foEl.setAttribute('x', (expandido.x - 26).toFixed(1))
    foEl.setAttribute('y', (expandido.y - 26).toFixed(1))
  }

  function expandir(n) {
    colapsar()
    const idx = NODES.indexOf(n)
    nodeEls[idx].style.display = 'none'
    const SIZE = 52
    const fo = document.createElementNS(NS, 'foreignObject')
    fo.setAttribute('x', (n.x - SIZE / 2).toFixed(1))
    fo.setAttribute('y', (n.y - SIZE / 2).toFixed(1))
    fo.setAttribute('width', SIZE); fo.setAttribute('height', SIZE)
    const posterHtml = n.poster ? `<img src="${esc(n.poster)}" alt="">` : `<div class="vp-mini-audio">&#9835;</div>`
    fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" class="vp-mini-card">
      ${posterHtml}
      <button type="button" class="vp-mini-play" aria-label="Reproducir">&#9654;</button>
      <div class="vp-mini-titulo">${esc(n.titulo)}</div>
    </div>`
    zoomG.appendChild(fo)
    foEl = fo; expandido = n

    fo.querySelector('.vp-mini-play').addEventListener('click', (ev) => {
      ev.stopPropagation()
      const iframe = document.createElement('iframe')
      iframe.setAttribute('allow', 'autoplay; encrypted-media')
      iframe.style.cssText = 'width:100%;height:100%;border:0;'
      iframe.src = n.kind === 'youtube'
        ? `https://www.youtube.com/embed/${n.vid}?autoplay=1&playsinline=1`
        : `https://open.spotify.com/embed/episode/${n.vid}`
      const tarjeta = fo.querySelector('.vp-mini-card')
      tarjeta.innerHTML = ''
      tarjeta.appendChild(iframe)
    })
  }

  function actualizarExpansion() {
    if (k < UMBRAL_EXPANDIR) { colapsar(); return }
    const wx = (W / 2 - tx) / k, wy = (H / 2 - ty) / k
    let mejor = null, mejorD = Infinity
    NODES.forEach((n) => { const d = Math.hypot(n.x - wx, n.y - wy); if (d < mejorD) { mejorD = d; mejor = n } })
    if (mejor && mejorD < 40) { if (expandido !== mejor) expandir(mejor) }
    else colapsar()
  }

  // ---------- 10) Botón: alterna entre las dos proyecciones, animado ----------
  render(0)
  let alpha = 0, animando = false
  const btn = document.getElementById('vp-play')
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

  function actualizarBoton() {
    btn.textContent = alpha < 0.5 ? 'Ver como red (equirectangular)' : 'Ver individual (ortográfica)'
  }
  actualizarBoton()

  btn.addEventListener('click', () => {
    if (animando) return
    colapsar()
    const desde = alpha, hasta = alpha < 0.5 ? 1 : 0
    const dur = 1600, t0 = performance.now()
    animando = true; btn.disabled = true
    ;(function frame(now) {
      const t = Math.min(1, (now - t0) / dur)
      alpha = desde + (hasta - desde) * easeInOutCubic(t)
      render(alpha)
      if (t < 1) requestAnimationFrame(frame)
      else { animando = false; btn.disabled = false; alpha = hasta; render(alpha); actualizarBoton() }
    })(t0)
  })
})()