// ============================================================
//  viz/productos.js — Diagrama de arcos de los productos educomunicativos
//
//  Cada producto es un punto sobre el eje horizontal. Los arcos que salen
//  hacia arriba son las relaciones entre piezas: mismo curso, mismo colegio,
//  mismo formato y mismo ecosistema. El color del arco es el ecosistema del
//  que sale, y las barras bajo el eje miden cuántas conexiones tiene cada una.
//
//  El orden del eje es lo que hace legible el dibujo: agrupados por localidad,
//  las relaciones de formato y ecosistema cruzan la ciudad y forman los arcos
//  largos; agrupados por ecosistema (botón), se invierte y son las de colegio
//  las que cruzan.
//
//  Se llama desde productos.html con window.initVizProductos() cuando la
//  grilla ya está pintada — las tarjetas llegan de Supabase, así que al cargar
//  el script todavía no existen.
// ============================================================
window.initVizProductos = function initVizProductos() {
  const items = [...document.querySelectorAll('#productos-container .producto-item')]
  const cont = document.getElementById('viz-productos-red')
  if (!items.length || !cont) return

  cont.innerHTML = ''

  const PAL_ECO = {
    humedal: '#5b8fbf', rio: '#4fa3a8', paramo: '#8aa87e', cerro: '#a8794f',
    'parque-urbano': '#6fa564', parque: '#6fa564', embalse: '#4f92a8', otro: '#a385c9',
  }
  const LBL_ECO = {
    humedal: 'Humedal', rio: 'Río', paramo: 'Páramo', cerro: 'Cerro',
    'parque-urbano': 'Parque urbano', parque: 'Parque urbano', embalse: 'Embalse', otro: 'Otro',
  }
  const colorEco = (e) => PAL_ECO[e] || '#b0a58c'
  const labelEco = (e) => LBL_ECO[e] || (e ? e.charAt(0).toUpperCase() + e.slice(1) : 'Otro')
  const esc = (s) => (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const bonito = (s) => (s || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

  // ---------- 1) Nodos, leídos del DOM ----------
  const NODES = items.map((el, i) => {
    const card = el.querySelector('.card-producto')
    return {
      i,
      id: card?.dataset.id || ('p' + i), el, card,
      titulo: card?.dataset.titulo || el.querySelector('.card-header')?.textContent?.trim() || 'Producto',
      colegioNombre: el.querySelector('.colegio-name')?.textContent?.trim() || '',
      eco: el.dataset.ecosistema || 'otro',
      formato: el.dataset.formato || '',
      colegio: el.dataset.colegio || '',
      localidad: el.dataset.localidad || '',
      curso: el.dataset.curso || '',
    }
  })
  if (NODES.length < 3) return

  // ---------- 2) Conexiones ----------
  // Dentro de un curso o de un colegio son pocas piezas, así que se unen todas
  // con todas. Formato y ecosistema tienen grupos de decenas: unir todos los
  // pares daría ~17.000 arcos, así que cada pieza se ata solo a las siguientes
  // del grupo. El dibujo se ve igual de tupido y el navegador respira.
  const EDGES = []
  const vistas = new Set()

  function unir(a, b, tipo) {
    if (a === b) return
    const clave = a < b ? a + '|' + b : b + '|' + a
    if (vistas.has(clave)) return
    vistas.add(clave)
    EDGES.push({ a, b, tipo })
  }

  function agrupar(campo) {
    const g = new Map()
    NODES.forEach((n) => {
      if (!n[campo]) return
      if (!g.has(n[campo])) g.set(n[campo], [])
      g.get(n[campo]).push(n.i)
    })
    return [...g.values()]
  }

  function todosLosPares(campo, tipo) {
    agrupar(campo).forEach((g) => {
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) unir(g[i], g[j], tipo)
    })
  }

  function vecinos(campo, tipo, k) {
    agrupar(campo).forEach((g) => {
      for (let i = 0; i < g.length; i++) {
        for (let d = 1; d <= k && i + d < g.length; d++) unir(g[i], g[i + d], tipo)
      }
    })
  }

  todosLosPares('curso', 'curso')
  todosLosPares('colegio', 'colegio')
  vecinos('formato', 'formato', 3)
  vecinos('eco', 'eco', 2)

  const ESTILO = {
    curso: { w: 1.1, op: 0.55 },
    colegio: { w: 0.8, op: 0.34 },
    formato: { w: 0.6, op: 0.20 },
    eco: { w: 0.5, op: 0.14 },
  }

  // Grado de conexión de cada pieza, para las barras bajo el eje.
  const grado = new Array(NODES.length).fill(0)
  EDGES.forEach((e) => { grado[e.a]++; grado[e.b]++ })
  const gradoMax = Math.max(1, ...grado)

  // ---------- 3) Orden del eje ----------
  const ORDENES = {
    territorio: {
      etiqueta: 'Agrupados por localidad',
      clave: (n) => [n.localidad, n.colegio, n.curso, n.id].join('|'),
      bandas: 'localidad',
    },
    ecosistema: {
      etiqueta: 'Agrupados por ecosistema',
      clave: (n) => [n.eco, n.localidad, n.colegio, n.id].join('|'),
      bandas: 'eco',
    },
  }
  let modo = 'territorio'
  let orden = []

  function reordenar() {
    const cfg = ORDENES[modo]
    orden = NODES.slice().sort((a, b) => cfg.clave(a).localeCompare(cfg.clave(b), 'es'))
    orden.forEach((n, pos) => { n.pos = pos })
  }

  // ---------- 4) Lienzo ----------
  const NS = 'http://www.w3.org/2000/svg'
  const W = 1200, H = 470
  const MX = 24            // margen lateral
  const Y_EJE = 372        // línea base
  const ALTO_ARCO = 330    // techo de los arcos
  const ALTO_BARRA = 82

  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('class', 'vp-arcos')
  cont.appendChild(svg)

  const gBandas = document.createElementNS(NS, 'g')
  const gArcos = document.createElementNS(NS, 'g')
  const gBarras = document.createElementNS(NS, 'g')
  const gNodos = document.createElementNS(NS, 'g')
  svg.append(gBandas, gArcos, gBarras, gNodos)

  const eje = document.createElementNS(NS, 'line')
  eje.setAttribute('stroke', '#cfc6b4'); eje.setAttribute('stroke-width', '1')
  svg.appendChild(eje)

  const x = (pos) => MX + (pos / (NODES.length - 1)) * (W - MX * 2)

  // Un arco por relación. `ry` se recorta para que los arcos largos no se
  // salgan del lienzo: son elipses, no semicírculos.
  const arcoEls = EDGES.map((e) => {
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', colorEco(NODES[e.a].eco))
    p.setAttribute('stroke-width', String(ESTILO[e.tipo].w))
    p.setAttribute('class', 'vp-arco')
    gArcos.appendChild(p)
    return p
  })

  const barraEls = NODES.map(() => {
    const r = document.createElementNS(NS, 'rect')
    r.setAttribute('class', 'vp-barra')
    gBarras.appendChild(r)
    return r
  })

  const nodoEls = NODES.map((n) => {
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('r', '2.2')
    c.setAttribute('fill', colorEco(n.eco))
    c.setAttribute('class', 'vp-punto')
    gNodos.appendChild(c)
    return c
  })

  // Etiquetas de banda (localidad o ecosistema) bajo las barras.
  let bandaEls = []
  function pintarBandas() {
    bandaEls.forEach((el) => el.remove())
    bandaEls = []
    const campo = ORDENES[modo].bandas
    let inicio = 0
    for (let i = 1; i <= orden.length; i++) {
      const cambio = i === orden.length || orden[i][campo] !== orden[inicio][campo]
      if (!cambio) continue
      const n0 = orden[inicio], n1 = orden[i - 1]
      const x0 = x(n0.pos), x1 = x(n1.pos)
      if (x1 - x0 > 26) {
        const t = document.createElementNS(NS, 'text')
        t.setAttribute('x', ((x0 + x1) / 2).toFixed(1))
        t.setAttribute('y', String(Y_EJE + ALTO_BARRA + 16))
        t.setAttribute('text-anchor', 'middle')
        t.setAttribute('class', 'vp-banda')
        t.textContent = campo === 'eco' ? labelEco(n0.eco) : bonito(n0.localidad)
        gBandas.appendChild(t)
        bandaEls.push(t)
      }
      if (i < orden.length) {
        const sep = document.createElementNS(NS, 'line')
        const xs = (x1 + x(orden[i].pos)) / 2
        sep.setAttribute('x1', xs.toFixed(1)); sep.setAttribute('x2', xs.toFixed(1))
        sep.setAttribute('y1', String(Y_EJE)); sep.setAttribute('y2', String(Y_EJE + ALTO_BARRA))
        sep.setAttribute('class', 'vp-sep')
        gBandas.appendChild(sep)
        bandaEls.push(sep)
      }
      inicio = i
    }
  }

  function render() {
    reordenar()
    eje.setAttribute('x1', String(MX - 8)); eje.setAttribute('x2', String(W - MX + 8))
    eje.setAttribute('y1', String(Y_EJE)); eje.setAttribute('y2', String(Y_EJE))

    NODES.forEach((n, i) => {
      const px = x(n.pos)
      nodoEls[i].setAttribute('cx', px.toFixed(1))
      nodoEls[i].setAttribute('cy', String(Y_EJE))
      const h = 4 + (grado[i] / gradoMax) * (ALTO_BARRA - 8)
      barraEls[i].setAttribute('x', (px - 1.3).toFixed(1))
      barraEls[i].setAttribute('y', String(Y_EJE))
      barraEls[i].setAttribute('width', '2.6')
      barraEls[i].setAttribute('height', h.toFixed(1))
      barraEls[i].setAttribute('fill', colorEco(n.eco))
    })

    EDGES.forEach((e, i) => {
      const xa = x(NODES[e.a].pos), xb = x(NODES[e.b].pos)
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb)
      const rx = Math.max(1, (x1 - x0) / 2)
      const ry = Math.min(rx, ALTO_ARCO)
      arcoEls[i].setAttribute('d', `M${x0.toFixed(1)},${Y_EJE} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${Y_EJE}`)
      arcoEls[i].setAttribute('opacity', String(ESTILO[e.tipo].op))
    })

    pintarBandas()
  }

  // ---------- 5) Leyenda ----------
  const ecosPresentes = [...new Set(NODES.map((n) => n.eco))].sort()
  const ley = document.getElementById('viz-productos-leyenda')
  if (ley) {
    ley.innerHTML = ecosPresentes
      .map((e) => `<span><span class="dot" style="background:${colorEco(e)}"></span>${labelEco(e)}</span>`)
      .join('') + '<span class="vp-nota">Cada arco une dos piezas relacionadas · la barra bajo el eje es cuántas conexiones tiene</span>'
  }

  // ---------- 6) Resaltado ----------
  // Con ~2.000 arcos no conviene reescribir opacidades una por una en cada
  // movimiento del mouse: se atenúa todo con una clase en el <svg> y solo se
  // marcan los pocos arcos que tocan la pieza señalada.
  const arcosDe = new Map()
  EDGES.forEach((e, i) => {
    if (!arcosDe.has(e.a)) arcosDe.set(e.a, [])
    if (!arcosDe.has(e.b)) arcosDe.set(e.b, [])
    arcosDe.get(e.a).push(i)
    arcosDe.get(e.b).push(i)
  })

  const tip = document.createElement('div')
  tip.className = 'vp-tip'
  cont.appendChild(tip)

  let resaltado = null

  function limpiar() {
    if (resaltado == null) return
    svg.classList.remove('vp-atenuado')
    ;(arcosDe.get(resaltado) || []).forEach((i) => arcoEls[i].classList.remove('vp-hl'))
    nodoEls[resaltado].classList.remove('vp-hl')
    barraEls[resaltado].classList.remove('vp-hl')
    tip.classList.remove('visible')
    resaltado = null
  }

  function resaltar(i) {
    if (resaltado === i) return
    limpiar()
    resaltado = i
    svg.classList.add('vp-atenuado')
    ;(arcosDe.get(i) || []).forEach((j) => arcoEls[j].classList.add('vp-hl'))
    nodoEls[i].classList.add('vp-hl')
    barraEls[i].classList.add('vp-hl')

    const n = NODES[i]
    tip.innerHTML = `<strong>${esc(n.titulo)}</strong><span>${esc(n.colegioNombre)} · ${esc(labelEco(n.eco))} · ${grado[i]} conexiones</span>`
    const rect = cont.getBoundingClientRect()
    const px = (x(n.pos) / W) * rect.width
    tip.style.left = Math.max(90, Math.min(rect.width - 90, px)) + 'px'
    tip.classList.add('visible')
  }

  function nodoEn(clientX) {
    const rect = svg.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * W
    let mejor = null, mejorD = Infinity
    NODES.forEach((n, i) => {
      const d = Math.abs(x(n.pos) - vx)
      if (d < mejorD) { mejorD = d; mejor = i }
    })
    return mejorD < 10 ? mejor : null
  }

  function irACard(n) {
    n.el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    n.card?.classList.remove('vp-highlight')
    void n.card?.offsetWidth
    n.card?.classList.add('vp-highlight')
    setTimeout(() => n.card?.classList.remove('vp-highlight'), 1500)
  }

  svg.addEventListener('mousemove', (ev) => {
    const i = nodoEn(ev.clientX)
    if (i == null) limpiar()
    else resaltar(i)
  })
  svg.addEventListener('mouseleave', limpiar)
  svg.addEventListener('click', (ev) => {
    const i = nodoEn(ev.clientX)
    if (i != null) irACard(NODES[i])
  })

  // Teclado: recorrer las piezas con las flechas, sin depender del mouse.
  svg.setAttribute('tabindex', '0')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', `Diagrama de arcos con ${NODES.length} productos educomunicativos y sus relaciones`)
  svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && resaltado != null) { irACard(NODES[resaltado]); return }
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
    ev.preventDefault()
    const actual = resaltado == null ? -1 : NODES[resaltado].pos
    const siguiente = Math.max(0, Math.min(NODES.length - 1, actual + (ev.key === 'ArrowRight' ? 1 : -1)))
    resaltar(orden[siguiente].i)
  })

  // ---------- 7) Sincronía con los filtros de la grilla ----------
  // Si el usuario filtra la grilla, las piezas ocultas se apagan aquí también.
  window.vizProductosSync = function vizProductosSync() {
    let hayFiltro = false
    NODES.forEach((n, i) => {
      const oculto = n.el.style.display === 'none'
      if (oculto) hayFiltro = true
      nodoEls[i].classList.toggle('vp-off', oculto)
      barraEls[i].classList.toggle('vp-off', oculto)
    })
    EDGES.forEach((e, i) => {
      const off = hayFiltro && (NODES[e.a].el.style.display === 'none' || NODES[e.b].el.style.display === 'none')
      arcoEls[i].classList.toggle('vp-off', off)
    })
  }

  // ---------- 8) Botón: cambia el orden del eje ----------
  const btn = document.getElementById('vp-play')
  const modoLbl = document.getElementById('vp-modo')
  if (modoLbl) modoLbl.textContent = ORDENES[modo].etiqueta

  if (btn) {
    const nuevo = btn.cloneNode(true)
    btn.replaceWith(nuevo)
    nuevo.textContent = 'Reagrupar por ecosistema'
    nuevo.addEventListener('click', () => {
      limpiar()
      modo = modo === 'territorio' ? 'ecosistema' : 'territorio'
      render()
      window.vizProductosSync?.()
      nuevo.textContent = modo === 'territorio' ? 'Reagrupar por ecosistema' : 'Reagrupar por localidad'
      if (modoLbl) modoLbl.textContent = ORDENES[modo].etiqueta
    })
  }

  render()
}