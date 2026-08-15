// ============================================================
//  datos.js — orquestador de la página "Datos descriptivos"
//
//  ESTRUCTURA:
//    core.js       -> helpers, cajas, registro de métricas, popup
//    formas.js     -> ruido, splines, arcos, figura humana
//    renderers.js  -> todas las visualizaciones (misma firma)
//    mock.js       -> DATOS QUEMADOS (marcados con * rojo)
//    db.js         -> consultas reales a Supabase
//
//  Cada métrica se REGISTRA con { titulo, descripcion, total, render, filtro }
//  y así la tarjeta y el popup usan exactamente el mismo dibujo.
// ============================================================
import {
  getDistribucionParticipacion, getTematicasEmergentes,
  participacionLabel,
  getComprensionDilema, getEcosistemas, getDiferencioSaberes, getCambiosPostura,
  getActoresRaw, getDebate, getReconocimiento, getProblematicas,
  getE2Detalle, getE3Detalle,
  getDocentesFase, getFormasComunicar, getIntencionVerbos, getPublicosObjetivo,
  getFormatosFinales,
} from './db.js'

import {
  COLORES, esc, norm, DET, aCol, box, vacio,
  registrar, abrirViz, activarDesplegables,
} from './viz/core.js'

import {
  renderNube, renderPictograma, renderBar, renderDoughnut,
  renderRadial, renderBlobs, renderFlujo, renderHojas, renderLluviaHojas,
  PAL_BLOB, rankNivel, categoriaProblema,
} from './viz/renderers.js'

import { MOCK } from './viz/mock.js'

// Alias para no tocar el código que ya funcionaba
let DET_E2 = [], DET_E3 = []

const ordenarPor = (filas, subs) => (filas || []).slice().sort((a, b) => {
  const idx = (t) => { const i = subs.findIndex((s) => (t || '').includes(s)); return i < 0 ? 999 : i }
  return idx(a.opcion) - idx(b.opcion)
})

// ---------- PICTOGRAMA: 1 figura = 1 curso ----------
// Figura NEUTRA (sin marcadores de género): cabeza, torso cápsula, brazos y piernas.
// ---------- Participación de CURSOS (blobs, datos reales) ----------
async function blobsParticipacion() {
  const cont = document.getElementById('viz-participacion')
  if (!cont) return
  const { data, error } = await getDistribucionParticipacion()
  if (error) return console.error('[blobs]', error)
  if (!data || !data.length) return vacio('viz-participacion', 'Sin datos registrados aún.')

  const acc = {}
  for (const r of data) { const k = r.nivel_participacion; if (k) acc[k] = (acc[k] ?? 0) + Number(r.cantidad || 0) }
  const filas = Object.entries(acc).filter(([, n]) => n > 0)
    .map(([k, n]) => ({ op: k, label: participacionLabel(k), n, rank: rankNivel(k) }))
    .sort((a, b) => a.rank - b.rank)
    .map((d, i, arr) => ({ ...d, color: PAL_BLOB[Math.round((i / Math.max(1, arr.length - 1)) * (PAL_BLOB.length - 1))] }))
  if (!filas.length) return vacio('viz-participacion', 'Sin datos registrados aún.')

  cont.classList.remove('viz-placeholder')
  renderBlobs(cont, filas, null)
}

async function cargarFase2y3() {
  // --- Comprensión (dona) ---
  {
    const { data } = await getComprensionDilema()
    const orden = ['Sí, claramente', 'Parcialmente', 'No quedó claro']
    const filas = (data || []).slice().sort((a, b) => orden.indexOf(a.opcion) - orden.indexOf(b.opcion))
    if (filas.length) {
      const full = filas.map((r) => r.opcion)
      const spec = { labels: full, full, valores: filas.map((r) => Number(r.n || 0)), colors: [COLORES[0], COLORES[2], COLORES[3]] }
      registrar('viz-comprension', {
        titulo: 'Comprensión del dilema múltiple',
        descripcion: 'Qué proporción de cursos comprendió que un dilema admite varias respuestas válidas. Registrado por el tutor en el Encuentro 2.',
        total: spec.valores.reduce((a, b) => a + b, 0),
        render: (el, onPick) => renderPictograma(el, spec, onPick),
        filtro: (op) => aCol(DET_E2.filter((r) => r.comprension === op)),
      })
      renderPictograma(box('viz-comprension'), spec, (op) => abrirViz('viz-comprension', op))
    } else vacio('viz-comprension', 'Sin datos registrados aún.')
  }

  // --- Ecosistemas (barras + normalización) ---
  {
    const { data } = await getEcosistemas()
    if (data && data.length) {
      const PAT = { 'Humedales':'humedal','Ríos y quebradas':'rio|quebrada|fucha|tunjuelo|salitre|juan amarillo','Páramos':'paramo|sumapaz','Cerros':'cerro|monserrate|guadalupe','Embalses':'embalse|represa|neusa|regadera|chisaca|san rafael|tomine','Parques urbanos':'parque' }
      const full = data.map((r) => r.ecosistema)
      const spec = { labels: full, full, valores: data.map((r) => Number(r.menciones || 0)), colors: COLORES[4] }
      const filasEco = data.map((r) => ({ nombre: r.ecosistema, n: Number(r.menciones || 0) }))
                           .sort((a, b) => b.n - a.n)
      const specEco = { labels: filasEco.map((f) => f.nombre), full: filasEco.map((f) => f.nombre), valores: filasEco.map((f) => f.n), colors: COLORES[4], horizontal: true }
      registrar('viz-ecosistemas', {
        titulo: 'Ecosistemas reconocidos',
        descripcion: 'Ecosistemas urbanos cercanos que los estudiantes reconocieron, agrupados por tipo. Un curso puede mencionar varios (Encuentro 2).',
        total: DET_E2.length,
        render: (el, onPick) => renderBar(el, specEco, onPick),
        filtro: (eco) => { const re = new RegExp(PAT[eco] || '', 'i'); return aCol(DET_E2.filter((r) => (r.ecosistemas || []).some((e) => re.test(norm(e))))) },
      })
      renderBar(box('viz-ecosistemas'), specEco, (op) => abrirViz('viz-ecosistemas', op))
    } else vacio('viz-ecosistemas', 'Sin datos registrados aún.')
  }

  // --- Diálogo de saberes: HOJAS (4 niveles, en vez de barras) ---
  {
    const { data } = await getDiferencioSaberes()
    const LBL = [{has:'No lograron',label:'No diferenciaron'},{has:'por separado',label:'Diferenciados (aparte)'},{has:'algunos momentos',label:'En diálogo (a veces)'},{has:'consistente',label:'Articularon (consistente)'}]
    const PAL = ['#c9748f', '#d1a94e', '#8ea86e', '#4f8f6a']
    const filasD = ordenarPor(data, ['No lograron','por separado','algunos momentos','consistente'])
    if (filasD.length) {
      const filas = filasD.map((r, i) => ({ op: r.opcion, label: LBL.find((m) => r.opcion.includes(m.has))?.label || r.opcion, n: Number(r.n || 0), color: PAL[i % PAL.length] }))
      registrar('viz-saberes', {
        titulo: 'Diálogo de saberes',
        descripcion: 'Cómo diferenciaron los cursos el saber popular del saber científico durante los debates (Encuentro 3).',
        total: filas.reduce((a, b) => a + b.n, 0),
        render: (el, onPick) => renderHojas(el, filas, onPick),
        filtro: (op) => aCol(DET_E3.filter((r) => r.saberes === op)),
      })
      renderHojas(box('viz-saberes'), filas, (op) => abrirViz('viz-saberes', op))
    } else vacio('viz-saberes', 'Sin datos registrados aún.')
  }
  // --- Cambios de postura: BLOBS (en vez de barras) ---
  {
    const { data } = await getCambiosPostura()
    const LBL = [{has:'No se observaron',label:'Sin cambios'},{has:'matizaron',label:'Matizaron (sin cambiar)'},{has:'cambiaron claramente',label:'Cambiaron postura'}]
    const PAL = ['#c9748f', '#d98f62', '#6bb3a4']
    const filasP = ordenarPor(data, ['No se observaron','matizaron','cambiaron claramente'])
    if (filasP.length) {
      const filas = filasP.map((r, i) => ({ op: r.opcion, label: LBL.find((m) => r.opcion.includes(m.has))?.label || r.opcion, n: Number(r.n || 0), color: PAL[i % PAL.length] }))
      registrar('viz-postura', {
        titulo: 'Cambios de postura',
        descripcion: 'Si hubo cambios de postura en los estudiantes a lo largo del debate (Encuentro 3).',
        total: filas.reduce((a, b) => a + b.n, 0),
        render: (el, onPick) => renderBlobs(el, filas, onPick),
        filtro: (op) => aCol(DET_E3.filter((r) => r.postura === op)),
      })
      renderBlobs(box('viz-postura'), filas, (op) => abrirViz('viz-postura', op))
    } else vacio('viz-postura', 'Sin datos registrados aún.')
  }
  {
    const { data } = await getDebate()
    const filasD = ordenarPor(data, ['debate rico', 'algo de debate', 'eligieron rápido'])
    if (filasD.length) {
      const LBL = [{has:'debate rico',label:'Debate rico'},{has:'algo de debate',label:'Algo de debate'},{has:'eligieron rápido',label:'Sin debate'}]
      const corto = (t) => LBL.find((m) => (t || '').includes(m.has))?.label || t
      const filas = filasD.map((r) => ({ op: r.opcion, label: corto(r.opcion), n: Number(r.n || 0) }))
      registrar('viz-debate', {
        titulo: 'Generación de debate',
        descripcion: 'Cuánta discusión se generó al elegir el dilema en el Encuentro 2.',
        total: filas.reduce((a, b) => a + b.n, 0),
        render: (el, onPick) => renderRadial(el, filas, onPick),
        filtro: (op) => aCol(DET_E2.filter((r) => r.debate === op)),
      })
      renderRadial(box('viz-debate'), filas, (op) => abrirViz('viz-debate', op))
    } else vacio('viz-debate', 'Sin datos registrados aún.')
  }

  // --- Reconocimiento: RADIAL de sectores (en vez de dona) ---
  {
    const { data } = await getReconocimiento()
    const filasR = ordenarPor(data, ['Bajo', 'Medio', 'Alto'])
    const LBL = [{has:'Bajo',label:'Bajo'},{has:'Medio',label:'Medio'},{has:'Alto',label:'Alto'}]
    const PAL_RECON = ['#cf9f4e', '#8ea86e', '#3d6b52']   // de dorado a verde oscuro
    if (filasR.length) {
      const filas = filasR.map((r) => ({ op: r.opcion, label: LBL.find((m) => r.opcion.includes(m.has))?.label || r.opcion, n: Number(r.n || 0) }))
      registrar('viz-reconocimiento', {
        titulo: 'Reconocimiento de ecosistemas',
        descripcion: 'Nivel con que los estudiantes reconocieron características y funciones de los ecosistemas (Encuentro 2).',
        total: filas.reduce((a, b) => a + b.n, 0),
        render: (el, onPick) => renderRadial(el, filas, onPick, PAL_RECON),
        filtro: (op) => aCol(DET_E2.filter((r) => r.reconocimiento === op)),
      })
      renderRadial(box('viz-reconocimiento'), filas, (op) => abrirViz('viz-reconocimiento', op), PAL_RECON)
    } else vacio('viz-reconocimiento', 'Sin datos registrados aún.')
  }

  // --- Problemáticas: barras horizontales, color por categoría ---
  {
    const { data } = await getProblematicas()
    if (data && data.length) {
      const colorProb = (op) => {
        const cat = categoriaProblema(op)
        return { agua: '#90B49D', escasez: '#CCA782', biodiversidad: '#9F574F', residuos: '#CCB364', ruido: '#9066CC', otro: '#54461E' }[cat]
      }
      const full = data.map((r) => r.opcion)
      const specProb = {
        labels: full.map((o) => o.replace('Otro, ¿Cuál?', 'Otro')), full,
        valores: data.map((r) => Number(r.n || 0)), colors: data.map((r) => colorProb(r.opcion)), horizontal: true,
      }
      registrar('viz-problematicas', {
        titulo: 'Problemáticas mencionadas',
        descripcion: 'Problemáticas ambientales que cada curso asoció a su dilema. Una por curso (Encuentro 2).',
        total: DET_E2.length,
        render: (el, onPick) => renderBar(el, specProb, onPick),
        filtro: (op) => aCol(DET_E2.filter((r) => (r.problematicas || []).includes(op))),
      })
      renderBar(box('viz-problematicas'), specProb, (op) => abrirViz('viz-problematicas', op))
    } else vacio('viz-problematicas', 'Sin datos registrados aún.')
  }

  // --- Actores (nube) ---
  {
    const { data } = await getActoresRaw()
    if (data && data.length) {
      const STOP = new Set(['de','la','el','los','las','y','o','del','en','a','un','una','con','the','otros','otras','etc','perfil','que','su','sus','al','se','por','para','como','mas'])

      // --- Singular: unifica plurales del español ---
      // comunidades->comunidad, vecinos->vecino, peces->pez, instituciones->institucion
      const singular = (w) => {
        if (w.length <= 4) return w
        if (w.endsWith('ces')) return w.slice(0, -3) + 'z'        // peces -> pez
        if (w.endsWith('es')) {
          const base = w.slice(0, -2)
          if (base.endsWith('on')) return base                    // instituciones -> institucion
          if (/[lrndyszj]$/.test(base)) return base               // arboles -> arbol, mujeres -> mujer
          return w.slice(0, -1)
        }
        if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)   // vecinos -> vecino
        return w
      }
      // Clave canónica: sin tildes, sin mayúsculas, cada palabra en singular
      const clave = (t) => norm(t).trim().split(/\s+/).map(singular).join(' ')

      const cuenta = new Map()
      for (const row of data) for (let p of (row.actores || '').split(/[\n,;/]|(?:\sy\s)/g)) {
        p = p.replace(/^\s*\d+[.)\-]\s*/, '').replace(/[()"'.:]/g, '').trim()
        if (!p || p.split(/\s+/).length > 4) continue
        const k = clave(p)
        if (k.length < 3 || STOP.has(k)) continue
        const cur = cuenta.get(k)
        if (cur) {
          cur.n += 1
          cur.variantes[p] = (cur.variantes[p] || 0) + 1
        } else {
          cuenta.set(k, { label: p, n: 1, variantes: { [p]: 1 }, clave: k })
        }
      }
      // Mostrar la variante MÁS usada de cada grupo, capitalizada
      for (const v of cuenta.values()) {
        const top = Object.entries(v.variantes).sort((a, b) => b[1] - a[1])[0][0]
        v.label = top.charAt(0).toUpperCase() + top.slice(1).toLowerCase()
      }
      const tokens = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 32)
      if (tokens.length) {
        registrar('viz-actores', {
          titulo: 'Actores definidos por el grupo', nube: true, mostrarTexto: false, total: DET_E3.length,
          descripcion: 'Actores que los cursos identificaron como involucrados en su dilema (Encuentro 3). El tamaño refleja cuántas veces se mencionó.',
          render: (el, onPick) => renderNube(el, tokens, onPick),
          filtro: (word) => { const raiz = norm(word).replace(/(ces|es|s)$/, ''); return aCol(DET_E3.filter((r) => norm(r.actores).includes(raiz))) },
        })
        const b = box('viz-actores', { nube: true })
        renderNube(b, tokens, (word, label) => abrirViz('viz-actores', word, label))
      } else vacio('viz-actores', 'Sin datos suficientes.')
    } else vacio('viz-actores', 'Sin datos registrados aún.')
  }
}

// ================= Formatos y temas: ahora con visuales propios =================
const PAL_FORMATOS = ['#9F574F', '#CCA782', '#90B49D', '#CCB364', '#6f9bd1', '#a385c9']

// Cuenta las piezas realmente publicadas (tabla productos). Antes usaba
// formatos_populares, que refleja lo que los grupos PROYECTARON en el
// Encuentro 4 — un número mayor que no cuadraba con los productos visibles.
async function graficaFormatos() {
  const { data, error } = await getFormatosFinales()
  if (error) return console.error('[formatos]', error)
  if (!data || data.length === 0) return vacio('viz-formatos', 'Sin datos registrados aún.')
  const top = data.slice(0, 8)
  const specFmt = {
    labels: top.map((r) => r.formato), full: top.map((r) => r.formato),
    valores: top.map((r) => Number(r.total_productos || 0)), colors: PAL_FORMATOS,
  }
  renderDoughnut(box('viz-formatos'), specFmt, null)   // dona clásica — sin detalle por curso para esta métrica
}
async function graficaTematicas() {
  const { data, error } = await getTematicasEmergentes()
  if (error) return console.error('[tematicas]', error)
  if (!data || data.length === 0) return vacio('viz-tematicas', 'Sin datos registrados aún.')
  // LLUVIA DE HOJAS: un círculo por tema (top 6), con el % adentro.
  // De cada uno caen hojas — cuantas más, más se mencionó ese tema.
  const totalGlobal = data.reduce((a, r) => a + Number(r.veces_mencionada || 0), 0)
  const top = data.slice().sort((a, b) => Number(b.veces_mencionada || 0) - Number(a.veces_mencionada || 0)).slice(0, 6)
  const filas = top.map((r, i) => ({
    op: r.tematica_normalizada, label: r.tematica_normalizada,
    n: Number(r.veces_mencionada || 0), color: PAL_FORMATOS[i % PAL_FORMATOS.length],
  }))
  const el = box('viz-tematicas')
  renderLluviaHojas(el, filas, null)   // texto libre agrupado -> sin filtro por curso disponible aún
}

// ================= BLOBS DE PARTICIPACIÓN (SVG + ruido) =================
// ============================================================
//  MÉTRICAS DE LA FASE 3 — ahora desde la base de datos
//  (antes vivían en viz/mock.js con asterisco rojo)
//
//  Sigue quemada una sola: "Aprendizajes en Ciencias Naturales"
//  (fenómeno natural vs. problemática ambiental). Ningún formulario
//  pregunta eso y el campo libre del E6 mezcla las dos cosas, así
//  que inventar la clasificación sería peor que dejar el asterisco.
// ============================================================

const LBL_FASE = { 2: 'Fase 2', 3: 'Fase 3' }
const LBL_ENC = { 2: 'Enc. 2', 3: 'Enc. 3', 4: 'Enc. 4', 6: 'Enc. 6', 7: 'Enc. 7' }

// --- Participación DOCENTE por fase (cintas de flujo) ---
// La Fase 1 fue un encuentro de activación sin bitácora, así que el flujo
// arranca en la Fase 2. El filtro de fases recorta las etapas visibles.
async function graficaDocentes() {
  const el = document.getElementById('viz-docentes')
  if (!el) return
  const { data, error } = await getDocentesFase()
  if (error) return console.error('[docentes]', error)
  if (!data || !data.length) return vacio('viz-docentes', 'Sin datos registrados aún.')

  const ORDEN = [
    'No participó', 'Estuvo atento', 'Intervino en algunos momentos', 'Participó activamente',
  ]
  const rank = (op) => {
    const i = ORDEN.findIndex((o) => (op || '').startsWith(o))
    return i < 0 ? 99 : i
  }

  const encuentros = [...new Set(data.map((r) => Number(r.encuentro)))].sort((a, b) => a - b)
  const opciones = [...new Set(data.map((r) => r.opcion))]
    .filter((o) => o !== 'Sin dato')
    .sort((a, b) => rank(a) - rank(b))

  function armar(fase) {
    const encs = encuentros.filter((e) => !fase || Number(data.find((r) => Number(r.encuentro) === e)?.fase) === fase)
    if (encs.length < 2) return null
    const etapas = encs.map((e) => LBL_ENC[e] ?? ('Enc. ' + e))
    // El color va por nivel de participación, con la misma rampa que los blobs
    // de participación de cursos: es la misma escala semántica (de menos a más
    // involucramiento), así las dos gráficas de la página se leen igual.
    // Sin `color`, renderFlujo pinta las cintas de negro.
    const series = opciones.map((op, i) => ({
      op,
      label: op,
      color: PAL_BLOB[Math.round((i / Math.max(1, opciones.length - 1)) * (PAL_BLOB.length - 1))],
      valores: encs.map((e) => {
        const fila = data.find((r) => Number(r.encuentro) === e && r.opcion === op)
        return Number(fila?.n || 0)
      }),
    }))
    return { etapas, series, encs }
  }

  let actual = armar(null)
  if (!actual) return vacio('viz-docentes', 'Se necesitan al menos dos encuentros para dibujar el flujo.')

  registrar('viz-docentes', {
    titulo: 'Participación docente por encuentro',
    descripcion: 'Cómo evolucionó el involucramiento de los docentes a lo largo de los encuentros. Cada cinta es un nivel de participación; su grosor es cuántas bitácoras lo reportaron. La Fase 1 no tuvo bitácora, así que el flujo empieza en el Encuentro 2.',
    total: data.reduce((a, r) => a + Number(r.n || 0), 0),
    valorDe: (op) => {
      const s = actual.series.find((x) => x.op === op)
      return s ? s.valores.reduce((a, b) => a + b, 0) : null
    },
    render: (elx, onPick) => renderFlujo(elx, actual.series, actual.etapas, onPick),
  })

  function pintar() {
    el.classList.add('viz-clickable')
    el.innerHTML = ''
    renderFlujo(el, actual.series, actual.etapas, (op) => abrirViz('viz-docentes', op))
  }
  pintar()

  const sel = document.getElementById('filtro-fase-docentes')
  sel?.addEventListener('change', () => {
    const fase = sel.value ? Number(sel.value) : null
    if (fase === 1) {
      el.innerHTML = '<div class="p-3 text-center small text-muted">La Fase 1 fue un encuentro de activación y no tuvo bitácora, así que no hay registro de participación docente.</div>'
      return
    }
    const nuevo = armar(fase)
    if (!nuevo) {
      el.innerHTML = '<div class="p-3 text-center small text-muted">Esta fase tiene un solo encuentro con bitácora; el flujo necesita al menos dos.</div>'
      return
    }
    actual = nuevo
    pintar()
  })
  document.querySelectorAll('.btn-limpiar').forEach((b) => b.addEventListener('click', () => {
    if (!sel) return
    sel.value = ''
    actual = armar(null)
    pintar()
  }))
}

// --- Aprendizajes destacados: dos hojas enfrentadas (sigue quemada) ---
function graficaAprendizajes() {
  const filas = MOCK.aprendizajes
  const total = filas.reduce((a, b) => a + b.n, 0)
  registrar('viz-aprendizajes', {
    titulo: 'Aprendizajes destacados en Ciencias Naturales *',
    descripcion: 'Si el producto educomunicativo puso el acento en explicar un fenómeno natural o en denunciar una problemática ambiental. Dato de ejemplo: ningún formulario recoge esta clasificación todavía.',
    total, quemado: true,
    valorDe: (op) => filas.find((f) => f.op === op)?.n ?? null,
    render: (el, onPick) => renderHojas(el, filas, onPick),
  })
  const el = document.getElementById('viz-aprendizajes')
  if (el) { el.classList.add('viz-clickable'); renderHojas(el, filas, (op) => abrirViz('viz-aprendizajes', op)) }
}

// --- Formas de comunicar: dona clásica ---
async function graficaComunicar() {
  const { data, error } = await getFormasComunicar()
  if (error) return console.error('[comunicar]', error)
  if (!data || !data.length) return vacio('viz-comunicar', 'Sin datos registrados aún.')
  const filas = data.map((r) => ({ nombre: r.nombre, n: Number(r.n || 0) }))
  const total = filas.reduce((a, b) => a + b.n, 0)
  const specCom = { labels: filas.map((f) => f.nombre), full: filas.map((f) => f.nombre), valores: filas.map((f) => f.n), colors: PAL_FORMATOS }
  registrar('viz-comunicar', {
    titulo: 'Formas de comunicar',
    descripcion: 'Lenguaje principal del producto educomunicativo: audiovisual, sonoro o gráfico.',
    total,
    valorDe: (op) => filas.find((f) => f.nombre === op)?.n ?? null,
    render: (el, onPick) => renderDoughnut(el, specCom, onPick),
  })
  const el = document.getElementById('viz-comunicar')
  if (el) { el.classList.add('viz-clickable'); renderDoughnut(el, specCom, (op) => abrirViz('viz-comunicar', op)) }
}

// --- Intención comunicativa (nube de verbos) ---
async function graficaIntencion() {
  const { data, error } = await getIntencionVerbos()
  if (error) return console.error('[intencion]', error)
  if (!data || !data.length) return vacio('viz-intencion', 'Sin datos registrados aún.')
  const tokens = data.map((r) => ({ label: r.label, n: Number(r.n || 0) }))
  const total = tokens.reduce((a, b) => a + b.n, 0)
  registrar('viz-intencion', {
    titulo: 'Intención comunicativa',
    descripcion: 'Verbos con que los grupos describieron qué querían lograr con su producto. El tamaño y el tono indican en cuántos productos aparece. Un mismo texto puede aportar varios verbos.',
    total, nube: true, mostrarTexto: false,
    valorDe: (w) => tokens.find((t) => norm(t.label) === norm(w))?.n ?? null,
    render: (el, onPick) => renderNube(el, tokens, onPick),
  })
  const el = box('viz-intencion', { nube: true })
  if (el) renderNube(el, tokens, (w, lbl) => abrirViz('viz-intencion', w, lbl))
}

// --- Públicos objetivos: barras horizontales ---
async function graficaPublicos() {
  const { data, error } = await getPublicosObjetivo()
  if (error) return console.error('[publicos]', error)
  if (!data || !data.length) return vacio('viz-publicos', 'Sin datos registrados aún.')
  const filas = data.map((r) => ({ op: r.op, label: r.label, n: Number(r.n || 0) }))
  const total = filas.reduce((a, b) => a + b.n, 0)
  const specPub = { labels: filas.map((f) => f.label), full: filas.map((f) => f.op), valores: filas.map((f) => f.n), colors: PAL_BLOB, horizontal: true }
  registrar('viz-publicos', {
    titulo: 'Públicos objetivos',
    descripcion: 'A quién dirigieron los grupos su producto educomunicativo.',
    total,
    valorDe: (op) => filas.find((f) => f.op === op)?.n ?? null,
    render: (el, onPick) => renderBar(el, specPub, onPick),
  })
  const el = document.getElementById('viz-publicos')
  if (el) { el.classList.add('viz-clickable'); renderBar(el, specPub, (op) => abrirViz('viz-publicos', op)) }
}

// ================= Arranque =================
async function init() {
  activarDesplegables()

  const [e2, e3] = await Promise.all([getE2Detalle(), getE3Detalle()])
  if (!e2.error) { DET_E2 = e2.data || []; DET.E2 = DET_E2 }
  if (!e3.error) { DET_E3 = e3.data || []; DET.E3 = DET_E3 }

  // Datos reales
  blobsParticipacion()
  cargarFase2y3()
  graficaFormatos()
  graficaTematicas()
  graficaDocentes()
  graficaComunicar()
  graficaIntencion()
  graficaPublicos()

  // Único dato quemado que queda (*)
  graficaAprendizajes()
}
init()