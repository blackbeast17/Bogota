/* =============================================
   BOG26 — Reproducción de productos educomunicativos
   ---------------------------------------------
   Los productos vienen de la vista `productos_publicos`, donde el embed ya
   llega desarmado en `embed_tipo` + `embed_id` + `embed_src`. Aquí solo
   decidimos cómo se ve y cómo suena cada tipo:

     youtube    → reproductor de YouTube (API JS, sabe el segundo actual)
     spotify    → reproductor de Spotify (iframe API)
     flickr     → imagen fija; "ver en grande" la abre en el popup
     web        → iframe genérico (juegos, sitios, flipbooks)
     enlace     → sin embebido posible, se abre en otra pestaña
     pendiente  → el equipo aún no entregó el archivo

   Este módulo lo usan productos.html y bitacora_detalle.html, así que la
   lógica de reproducción vive en un solo sitio.
   ============================================= */

import { esc } from './db.js'

/* ---------------------------------------------------------------------------
   Presentación
   --------------------------------------------------------------------------- */

// Color del badge según la forma de comunicar.
const COLOR_FORMA = {
  Audiovisual: 'var(--verde-oscuro)',
  Sonoro: 'var(--dorado)',
  'Gráfico': 'var(--terracota)',
}

export function colorForma(forma) {
  return COLOR_FORMA[forma] ?? 'var(--verde-medio)'
}

// Ícono de respaldo cuando no hay miniatura que mostrar.
const ICONO = {
  spotify: 'bi-mic-fill',
  web: 'bi-globe2',
  enlace: 'bi-box-arrow-up-right',
  pendiente: 'bi-hourglass-split',
}

// Miniatura: YouTube la sirve por URL, Flickr ya nos la dio en la matriz,
// Spotify la pedimos después vía oEmbed (ver `cargarPortadasSpotify`).
export function posterHtml(p) {
  if (p.embed_tipo === 'youtube' && p.embed_id) {
    return `<img class="media-poster" loading="lazy" alt=""
              src="https://i.ytimg.com/vi/${esc(p.embed_id)}/hqdefault.jpg">`
  }
  // Flickr siempre trae imagen; algunos 'web' también (cuando la celda de la
  // matriz traía el juego y además el álbum con la versión para imprimir).
  if (p.imagen_url) {
    return `<img class="media-poster" loading="lazy" alt="${esc(p.nombre ?? '')}"
              src="${esc(p.imagen_url)}">`
  }
  const icono = ICONO[p.embed_tipo] ?? 'bi-collection-play'
  return `<div class="media-poster media-poster-audio"><i class="bi ${icono}"></i></div>`
}

// Botón central: play para lo que suena, lupa para imagen, flecha para enlace.
function botonHtml(p) {
  if (p.embed_tipo === 'youtube') return '<div class="play-btn" data-action="play"><i class="bi bi-play-fill"></i></div>'
  if (p.embed_tipo === 'spotify') return '<div class="play-btn" data-action="play"><i class="bi bi-volume-up-fill"></i></div>'
  if (p.embed_tipo === 'flickr') return '<div class="play-btn" data-action="grande"><i class="bi bi-arrows-fullscreen"></i></div>'
  if (p.embed_tipo === 'web') return '<div class="play-btn" data-action="grande"><i class="bi bi-joystick"></i></div>'
  if (p.embed_tipo === 'enlace') return '<div class="play-btn" data-action="abrir"><i class="bi bi-box-arrow-up-right"></i></div>'
  return ''
}

// El área de medios completa: miniatura + botón + etiqueta de forma.
export function mediaAreaHtml(p) {
  const badge = p.forma
    ? `<span class="badge position-absolute top-0 end-0 m-2" style="background:${colorForma(p.forma)};">${esc(p.forma)}</span>`
    : ''
  const aviso = p.embed_tipo === 'pendiente'
    ? '<span class="badge position-absolute bottom-0 start-0 m-2" style="background:var(--gris-medio);color:var(--negro);">Próximamente</span>'
    : ''
  return `<div class="media-area" data-slot="media">
      ${posterHtml(p)}
      ${botonHtml(p)}
      ${badge}${aviso}
    </div>`
}

// Atributos que el reproductor y los filtros necesitan leer del DOM.
export function cardAttrs(p, id) {
  return [
    `data-id="${esc(id)}"`,
    `data-kind="${esc(p.embed_tipo ?? 'pendiente')}"`,
    `data-vid="${esc(p.embed_id ?? '')}"`,
    `data-src="${esc(p.embed_src ?? '')}"`,
    `data-enlace="${esc(p.enlace_publico ?? '')}"`,
    `data-imagen="${esc(p.imagen_url ?? '')}"`,
    `data-titulo="${esc(p.nombre ?? 'Producto educomunicativo')}"`,
  ].join(' ')
}

/* ---------------------------------------------------------------------------
   Reproducción
   --------------------------------------------------------------------------- */

// APIs externas: llegan cuando llegan, así que encolamos lo que dependa de ellas.
let ytListo = false
const colaYT = []
window.onYouTubeIframeAPIReady = () => { ytListo = true; colaYT.forEach((f) => f()); colaYT.length = 0 }
const cuandoYT = (f) => (ytListo ? f() : colaYT.push(f))

let spotifyAPI = null
const colaSpotify = []
window.onSpotifyIframeApiReady = (API) => { spotifyAPI = API; colaSpotify.forEach((f) => f(API)); colaSpotify.length = 0 }
const cuandoSpotify = (f) => (spotifyAPI ? f(spotifyAPI) : colaSpotify.push(f))

const players = {}       // id -> { kind, yt | spotify, pos }
let enModal = null

// Solo uno suena a la vez.
function pausarOtros(salvo) {
  Object.entries(players).forEach(([id, p]) => {
    if (id === salvo) return
    try {
      if (p.kind === 'youtube') p.yt?.pauseVideo?.()
      if (p.kind === 'spotify') p.spotify?.pause?.()
    } catch (e) { /* el reproductor todavía no está listo */ }
  })
}

function reproducirInline(card) {
  const { id, kind, vid, src } = card.dataset
  const media = card.querySelector('[data-slot="media"]')
  const btnGrande = card.querySelector('[data-action="grande"]')

  pausarOtros(id)

  if (players[id]) {
    if (players[id].kind === 'youtube') players[id].yt?.playVideo?.()
    if (players[id].kind === 'spotify') players[id].spotify?.resume?.()
    return
  }

  media.querySelector('.media-poster')?.remove()
  media.querySelector('.play-btn')?.remove()
  const host = document.createElement('div')
  media.appendChild(host)

  if (kind === 'youtube') {
    cuandoYT(() => {
      players[id] = {
        kind,
        yt: new YT.Player(host, {
          videoId: vid,
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: (e) => e.target.playVideo(),
            onStateChange: (e) => { if (e.data === YT.PlayerState.PLAYING) pausarOtros(id) },
          },
        }),
      }
    })
  } else if (kind === 'spotify') {
    cuandoSpotify((API) => {
      API.createController(host, { uri: uriSpotify(vid, src), width: '100%', height: '100%' }, (ctrl) => {
        players[id] = { kind, spotify: ctrl, pos: 0 }
        ctrl.addListener('playback_update', (e) => {
          players[id].pos = (e.data.position || 0) / 1000
          if (!e.data.isPaused) pausarOtros(id)
        })
        ctrl.play()
      })
    })
  }

  btnGrande?.classList.remove('d-none')
}

// La matriz trae episodios de Spotify, pero el src puede venir con otro tipo
// (track, show); respetamos el que diga la URL.
function uriSpotify(vid, src) {
  const m = /embed\/(episode|track|show|playlist)\//.exec(src ?? '')
  return `spotify:${m ? m[1] : 'episode'}:${vid}`
}

function verEnGrande(card, { modalEl, titulo, cuerpo }) {
  const { id, kind, vid, src, imagen, enlace } = card.dataset
  const p = players[id]
  titulo.textContent = card.dataset.titulo || ''
  cuerpo.innerHTML = ''
  cuerpo.className = 'player-wrap ' + (kind === 'spotify' ? 'audio' : 'video')

  let t = 0
  if (kind === 'youtube' && p?.yt?.getCurrentTime) { t = p.yt.getCurrentTime(); p.yt.pauseVideo() }
  if (kind === 'spotify') { t = p?.pos || 0; p?.spotify?.pause?.() }

  if (kind === 'flickr') {
    cuerpo.className = 'player-wrap'
    cuerpo.innerHTML = `<img src="${esc(imagen)}" alt="${esc(card.dataset.titulo)}"
        style="width:100%;height:auto;display:block;">
      ${enlace ? `<div class="p-2 text-end"><a href="${esc(enlace)}" target="_blank" rel="noopener"
        class="btn-grande">Ver en Flickr <i class="bi bi-box-arrow-up-right"></i></a></div>` : ''}`
    bootstrap.Modal.getOrCreateInstance(modalEl).show()
    return
  }

  if (kind === 'web') {
    cuerpo.className = 'player-wrap juego'
    const destino = src || enlace
    cuerpo.innerHTML = `<iframe src="${esc(destino)}" title="${esc(card.dataset.titulo)}"
        frameborder="0" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
      <div class="player-fallback">
        ¿No carga el juego? <a href="${esc(destino)}" target="_blank" rel="noopener">Ábrelo en otra pestaña</a>
      </div>`
    bootstrap.Modal.getOrCreateInstance(modalEl).show()
    return
  }

  const host = document.createElement('div')
  cuerpo.appendChild(host)

  if (kind === 'youtube') {
    cuandoYT(() => {
      const yt = new YT.Player(host, {
        videoId: vid,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, start: Math.floor(t) },
        events: { onReady: (e) => { e.target.seekTo(t, true); e.target.playVideo() } },
      })
      enModal = { id, kind, player: yt }
    })
  } else {
    cuandoSpotify((API) => {
      API.createController(host, { uri: uriSpotify(vid, src), width: '100%', height: 352 }, (ctrl) => {
        enModal = { id, kind, player: ctrl, pos: t }
        ctrl.addListener('ready', () => { ctrl.seek(t); ctrl.play() })
      })
    })
  }

  bootstrap.Modal.getOrCreateInstance(modalEl).show()
}

/* ---------------------------------------------------------------------------
   Enganche
   --------------------------------------------------------------------------- */

// Conecta los botones de todas las tarjetas que haya dentro de `root`.
// Se puede llamar varias veces (al re-renderizar la grilla, por ejemplo):
// las tarjetas ya enganchadas se marcan y no se vuelven a procesar.
export function montarMedia(root = document, modalId = 'modalProducto') {
  const modalEl = document.getElementById(modalId)
  if (!modalEl) return
  const titulo = modalEl.querySelector('[data-slot="titulo"]')
  const cuerpo = modalEl.querySelector('[data-slot="player"]')

  if (!modalEl.dataset.montado) {
    modalEl.dataset.montado = '1'
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!enModal) { cuerpo.innerHTML = ''; return }
      const { id, kind, player } = enModal
      let t = 0
      try {
        if (kind === 'youtube') { t = player.getCurrentTime?.() || 0; player.pauseVideo?.(); player.destroy?.() }
        if (kind === 'spotify') { t = enModal.pos || 0; player.pause?.() }
      } catch (e) { /* el reproductor ya se fue */ }

      const p = players[id]
      try {
        if (p?.kind === 'youtube' && p.yt?.seekTo) { p.yt.seekTo(t, true); p.yt.pauseVideo() }
        if (p?.kind === 'spotify' && p.spotify?.seek) { p.spotify.seek(t); p.spotify.pause() }
      } catch (e) { /* idem */ }

      cuerpo.innerHTML = ''
      enModal = null
    })
  }

  root.querySelectorAll('.card-producto[data-id]:not([data-montado])').forEach((card) => {
    card.dataset.montado = '1'
    card.querySelector('[data-action="play"]')?.addEventListener('click', () => reproducirInline(card))
    card.querySelector('[data-action="grande"]')?.addEventListener('click', () => verEnGrande(card, { modalEl, titulo, cuerpo }))
    card.querySelector('[data-action="abrir"]')?.addEventListener('click', () => {
      if (card.dataset.enlace) window.open(card.dataset.enlace, '_blank', 'noopener')
    })
  })

  cargarPortadasSpotify(root)
}

// Spotify no expone la portada por URL, hay que pedirla. Son ~60 productos,
// así que solo la pedimos cuando la tarjeta entra en pantalla.
function cargarPortadasSpotify(root) {
  const pendientes = root.querySelectorAll('.card-producto[data-kind="spotify"]:not([data-portada])')
  if (!pendientes.length || !('IntersectionObserver' in window)) return

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(async (e) => {
      if (!e.isIntersecting) return
      const card = e.target
      obs.unobserve(card)
      card.dataset.portada = '1'
      const url = card.dataset.enlace || `https://open.spotify.com/episode/${card.dataset.vid}`
      try {
        const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
        const j = await r.json()
        if (!j.thumbnail_url) return
        const ph = card.querySelector('.media-poster-audio')
        if (!ph) return
        const img = document.createElement('img')
        img.className = 'media-poster'
        img.src = j.thumbnail_url
        img.alt = ''
        ph.replaceWith(img)
      } catch (err) { /* se queda el ícono de micrófono */ }
    })
  }, { rootMargin: '200px' })

  pendientes.forEach((c) => obs.observe(c))
}