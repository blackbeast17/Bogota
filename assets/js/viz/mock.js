// ============================================================
//  mock.js — DATOS QUEMADOS (de ejemplo)
//  ⚠  NADA de esto sale de Supabase. Son cifras inventadas para
//     poder mostrar el diseño de las visualizaciones que Lina
//     todavía no ha definido.
//
//  Cada métrica que use este archivo lleva un ASTERISCO ROJO (*)
//  en el título de la tarjeta, en datos.html.
//
//  CÓMO CONECTARLAS A LA BASE, cuando existan los datos:
//    1. Crear la vista/consulta en Supabase y su getter en db.js
//    2. En datos.js, cambiar `MOCK.x` por el `await getX()`
//    3. Quitar `quemado: true` del registrar(...)
//    4. Borrar el <span class="ast">*</span> del título en datos.html
// ============================================================

export const MOCK = {

  // --- Participación DOCENTE por fase (flujo de cintas) ---
  // Ejes: Fase 1 -> Fase 2 -> Fase 3 (cómo se mueve el involucramiento)
  docentes: {
    etapas: ['Fase 1', 'Fase 2', 'Fase 3'],
    series: [
      { op: 'activa',    label: 'Participó activamente',  color: '#6bb3a4', valores: [22, 41, 58] },
      { op: 'intervino', label: 'Intervino a veces',      color: '#6f9bd1', valores: [38, 44, 39] },
      { op: 'atento',    label: 'Atento, sin intervenir', color: '#a385c9', valores: [46, 33, 24] },
      { op: 'presente',  label: 'Solo presente',          color: '#d98f62', valores: [27, 18, 14] },
      { op: 'no',        label: 'No participó',           color: '#c9748f', valores: [12, 5, 6] },
    ],
  },

  // --- Aprendizajes destacados en Ciencias Naturales (hojas) ---
  aprendizajes: [
    { op: 'fenomenos',     label: 'Fenómenos naturales',        n: 62, color: '#90B49D' },
    { op: 'problematicas', label: 'Problemáticas ambientales',  n: 79, color: '#9F574F' },
  ],

  // --- Formas de comunicar (siluetas) ---
  comunicar: [
    { nombre: 'Audiovisual', n: 68 },
    { nombre: 'Sonoro',      n: 41 },
    { nombre: 'Gráfico',     n: 32 },
  ],

  // --- Intención comunicativa (nube de verbos) ---
  intencion: [
    { label: 'Concientizar', n: 34 }, { label: 'Reflexionar', n: 28 },
    { label: 'Denunciar',    n: 21 }, { label: 'Incentivar',  n: 19 },
    { label: 'Proteger',     n: 17 }, { label: 'Visibilizar', n: 15 },
    { label: 'Incidir',      n: 13 }, { label: 'Cuidar',      n: 12 },
    { label: 'Informar',     n: 11 }, { label: 'Convocar',    n: 9 },
    { label: 'Preservar',    n: 8 },  { label: 'Alertar',     n: 7 },
    { label: 'Educar',       n: 6 },  { label: 'Transformar', n: 5 },
    { label: 'Recuperar',    n: 4 },  { label: 'Compartir',   n: 3 },
  ],

  // --- Públicos objetivos (radial de sectores) ---
  publicos: [
    { op: 'comunidad',  label: 'Comunidad del barrio', n: 44 },
    { op: 'estudiantes',label: 'Otros estudiantes',    n: 38 },
    { op: 'familias',   label: 'Familias',             n: 26 },
    { op: 'autoridades',label: 'Autoridades locales',  n: 18 },
    { op: 'general',    label: 'Público general',      n: 15 },
  ],
}
