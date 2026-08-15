/* =============================================
   BOG26 — Capa de datos (Supabase)
   ---------------------------------------------
   Sitio estático sin build: cargamos el cliente
   de Supabase por CDN (ESM) igual que Bootstrap.
   La anon key es pública por diseño; el acceso
   real lo protege RLS en la base de datos.
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- Configuración del proyecto Supabase (proyecto Vidal) ---
const SUPABASE_URL = 'https://efdssqphticqwkfhlfun.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHNzcXBodGljcXdrZmhsZnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDA0OTIsImV4cCI6MjA5OTIxNjQ5Mn0.hAduLICmqi8gt2lWD3ZNobkF4zG51QNXX1L4Ks6BpEg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ---------------------------------------------------------------------------
   Helpers de lectura sobre las vistas ya definidas en db/migrations.
   Cada uno devuelve { data, error } para que la página decida cómo mostrar
   estados de carga / vacío / error.
   --------------------------------------------------------------------------- */

// Una fila por (curso, encuentro): la bitácora viva más reciente.
// Ideal para la grilla de "Instituciones Educativas".
export async function getBitacorasUltimas() {
  return supabase
    .from('bitacoras_ultimas')
    .select('*')
    .order('codigo_curso', { ascending: true })
}

// Grilla filtrada DESDE LA BASE DE DATOS. Cada filtro que venga con valor se
// traduce en un .eq() de la consulta, así el trabajo lo hace Postgres y no el
// navegador. `filtros` acepta { localidad, colegio, nivel } (valores reales,
// no slugs). Devuelve el mismo shape que getBitacorasUltimas.
export async function getBitacorasFiltradas(filtros = {}) {
  let query = supabase.from('bitacoras_ultimas').select('*')
  if (filtros.localidad) query = query.eq('localidad', filtros.localidad)
  if (filtros.colegio) query = query.eq('colegio', filtros.colegio)
  if (filtros.nivel) query = query.eq('nivel', filtros.nivel)
  return query.order('codigo_curso', { ascending: true })
}

// Todas las bitácoras (historial completo) de un curso, p. ej. "IED7A".
export async function getBitacorasDeCurso(codigoCurso) {
  return supabase
    .from('bitacoras_resumen')
    .select('*')
    .eq('codigo_curso', codigoCurso)
    .order('encuentro_numero', { ascending: true })
}

// Una bitácora puntual por id (uuid).
export async function getBitacoraPorId(id) {
  return supabase.from('bitacoras_resumen').select('*').eq('id', id).single()
}


// Dilemas definitivos por curso (Encuentro 6) para dilemas.html.
export async function getDilemas() {
  return supabase
    .from('dilemas_publicos')
    .select('*')
    .order('colegio', { ascending: true })
}


// --- Productos educomunicativos (productos.html, bitacora_detalle.html) ---

// Todos los productos con su curso, colegio, ecosistema y dilema.
export async function getProductos() {
  return supabase
    .from('productos_publicos')
    .select('*')
    .order('colegio', { ascending: true })
    .order('orden', { ascending: true })
}

// Los productos de un solo curso, p. ej. "IED7A".
export async function getProductosDeCurso(codigoCurso) {
  return supabase
    .from('productos_publicos')
    .select('*')
    .eq('codigo_curso', codigoCurso)
    .order('orden', { ascending: true })
}


// --- Vistas analíticas (datos.html) ---

// Participación docente por encuentro y fase (flujo).
export async function getDocentesFase() {
  return supabase
    .from('datos_docentes_fase')
    .select('*')
    .order('encuentro', { ascending: true })
}

// Formas de comunicar de los productos publicados.
export async function getFormasComunicar() {
  return supabase.from('datos_formas_comunicar').select('*').order('n', { ascending: false })
}

// Verbos de la intención comunicativa (nube).
export async function getIntencionVerbos() {
  return supabase.from('datos_intencion_verbos').select('*').order('n', { ascending: false })
}

// Públicos objetivos de los productos.
export async function getPublicosObjetivo() {
  return supabase.from('datos_publicos_objetivo').select('*').order('n', { ascending: false })
}

// Formatos realmente producidos (Encuentro 6), no los proyectados en el E4.
export async function getFormatosFinales() {
  return supabase.from('formatos_finales').select('*').order('total_productos', { ascending: false })
}

// Distribución de niveles de participación por encuentro.
export async function getDistribucionParticipacion() {
  return supabase
    .from('distribucion_participacion')
    .select('*')
    .order('encuentro_id', { ascending: true })
}

// Popularidad de formatos elegidos (Fase 3 / producción).
export async function getFormatosPopulares() {
  return supabase
    .from('formatos_populares')
    .select('*')
    .order('total_grupos', { ascending: false })
}

// Temáticas emergentes (respuesta abierta agregada).
export async function getTematicasEmergentes() {
  return supabase
    .from('tematicas_emergentes')
    .select('*')
    .order('veces_mencionada', { ascending: false })
}

// Métricas agregadas por colegio (para tarjetas resumen / totales).
export async function getMetricasPorColegio() {
  return supabase
    .from('metricas_por_colegio')
    .select('*')
    .order('total_bitacoras', { ascending: false })
}

/* ---------------------------------------------------------------------------
   Utilidades de presentación compartidas
   --------------------------------------------------------------------------- */

// Etiquetas legibles para los slugs de formato guardados en JSONB.
export const FORMATO_LABELS = {
  radionovela: 'Radionovela',
  cancion_original: 'Canción original',
  historieta: 'Historieta',
  linea_de_tiempo: 'Línea de tiempo',
  escena_performatica: 'Escena performática',
  entrevista_audiovisual: 'Entrevista audiovisual',
}

export function formatoLabel(key) {
  return FORMATO_LABELS[key] ?? key
}

// Etiquetas legibles para los niveles de participación (meta_general).
export const PARTICIPACION_LABELS = {
  muy_baja: 'Muy baja',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  muy_alta: 'Muy alta',
  sin_dato: 'Sin dato',
}

export function participacionLabel(key) {
  return PARTICIPACION_LABELS[key] ?? key
}

// slug simple para usar en filtros/atributos data-*.
// Normaliza acentos vía NFD y descarta las marcas combinantes (rango unicode
// escrito con \u para no depender del encoding del archivo servido).
export function slug(texto) {
  return (texto ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Escapa texto para insertarlo con innerHTML de forma segura.
export function esc(s) {
  return (s ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
// --- Datos E2/E3 para datos.html (vistas nuevas) ---
export async function getComprensionDilema() {
  return supabase.from('datos_comprension_dilema').select('*')
}
export async function getEcosistemas() {
  return supabase.from('datos_ecosistemas').select('*').order('orden', { ascending: true })
}
export async function getDiferencioSaberes() {
  return supabase.from('datos_diferencio_saberes').select('*')
}
export async function getCambiosPostura() {
  return supabase.from('datos_cambios_postura').select('*')
}
export async function getActoresRaw() {
  return supabase.from('datos_actores_raw').select('*')
}

export async function getDebate() {
  return supabase.from('datos_debate').select('*')
}
export async function getReconocimiento() {
  return supabase.from('datos_reconocimiento').select('*')
}
export async function getProblematicas() {
  return supabase.from('datos_problematicas').select('*')
}
export async function getE2Detalle() {
  return supabase.from('datos_e2_detalle').select('*')
}
export async function getE3Detalle() {
  return supabase.from('datos_e3_detalle').select('*')
}