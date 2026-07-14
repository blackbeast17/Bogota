// ============================================================
//  formas.js — primitivas geométricas reutilizables
//  Ruido, splines, arcos y la figura humana del pictograma.
//  Sin dependencias externas (no cargamos simplex-noise ni d3).
// ============================================================

// --- Ruido tipo Perlin (2D), escrito a mano ---
export function crearRuido() {
  const perm = [...Array(256).keys()]
  for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255]
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a, b, t) => a + t * (b - a)
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y)
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
    const xf = x - Math.floor(x), yf = y - Math.floor(y)
    const u = fade(xf), v = fade(yf)
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1]
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
                lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v)
  }
}

// Spline cerrado (Catmull-Rom → Bézier): contorno suave del blob

// --- Spline cerrado (Catmull-Rom -> Bézier): contorno suave de un blob ---
export function spline(pts) {
  const n = pts.length
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}` +
         ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}` +
         ` ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d + ' Z'
}

// --- Arco/sector desde el centro (0 rad = arriba) ---
export function arcoPath(cx, cy, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 0.001) {          // círculo completo
    return `M ${cx},${cy - r} A ${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`
  }
  const px = (a, rr) => [cx + Math.sin(a) * rr, cy - Math.cos(a) * rr]
  const [x0, y0] = px(a0, r), [x1, y1] = px(a1, r)
  const largo = (a1 - a0) > Math.PI ? 1 : 0
  return `M ${cx},${cy} L ${x0.toFixed(1)},${y0.toFixed(1)} A ${r},${r} 0 ${largo} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`
}

// --- Figura humana NEUTRA + rotación de idles (pictograma) ---
export const IDLES = ['fig-a', 'fig-b', 'fig-c']   // saluda / cambia el peso / respira

export function figuraSVG(color, i) {
  const idle  = IDLES[i % IDLES.length]
  const dur   = (2.4 + (i % 7) * 0.28).toFixed(2) + 's'   // ritmos distintos
  const delay = ((i % 13) * 0.31).toFixed(2) + 's'        // desfase: nadie sincronizado
  return `
    <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
      <g class="fig ${idle}" fill="${color}" style="--dur:${dur}; --delay:${delay};">
        <circle class="cabeza" cx="6" cy="3" r="2.6"/>
        <rect class="brazo-i" x="1.1" y="7.2" width="1.5" height="5.6" rx=".75"/>
        <rect class="brazo-d" x="9.4" y="7.2" width="1.5" height="5.6" rx=".75"/>
        <rect class="cuerpo"  x="3.2" y="6.5" width="5.6" height="7.4" rx="2.8"/>
        <rect class="pierna"  x="4.1" y="13.2" width="1.6" height="6.5" rx=".8"/>
        <rect class="pierna"  x="6.3" y="13.2" width="1.6" height="6.5" rx=".8"/>
      </g>
    </svg>`
}

// Rota los idles: cada cierto tiempo un lote de figuras cambia de animación.
// Un solo temporizador para todas (no 141) -> sin costo de rendimiento.
export function rotarIdles(el) {
  const figs = [...el.querySelectorAll('.fig')]
  if (!figs.length) return
  let paso = 0
  const timer = setInterval(() => {
    if (!el.isConnected) { clearInterval(timer); return }   // limpieza
    // Cambia ~1/5 de las figuras por vuelta, escalonado
    for (let k = paso % 5; k < figs.length; k += 5) {
      const f = figs[k]
      const actual = IDLES.findIndex((c) => f.classList.contains(c))
      const siguiente = IDLES[(actual + 1 + Math.floor(Math.random() * 2)) % IDLES.length]
      f.classList.remove(...IDLES)
      f.classList.add(siguiente)
      f.style.setProperty('--delay', (Math.random() * 0.6).toFixed(2) + 's')
    }
    paso++
  }, 3200)
}
