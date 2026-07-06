# BOG26 — Sitio oficial conectado a Supabase

Este sitio estático ahora lee datos **en vivo** desde la base de datos del proyecto
Vidal (Supabase), reemplazando los datos de ejemplo que traía la maqueta.

## Cómo correrlo

Los módulos ES (`<script type="module">`) **no funcionan abriendo el HTML con doble
clic** (`file://`). Hay que servirlo por HTTP. Desde esta carpeta (`bog26/`):

```bash
python -m http.server 5500
# luego abrir http://localhost:5500/bitacoras.html
```

(o `npx serve` si prefieres Node).

## Qué quedó conectado

| Página | Fuente (vista en `db/migrations`) |
|---|---|
| `bitacoras.html` | `bitacoras_ultimas` — una tarjeta por curso, filtros poblados con datos reales |
| `bitacora_detalle.html?curso=IED7A` | `bitacoras_resumen` filtrado por `codigo_curso` |
| `datos.html` | `distribucion_participacion`, `formatos_populares`, `tematicas_emergentes` (Chart.js) |

La capa de datos vive en **`assets/js/db.js`** (cliente Supabase + helpers). La URL y
la anon key están ahí; la anon key es pública por diseño y el acceso lo protege RLS.

## Pendientes / a verificar contra la BD en vivo

1. **Grants a `anon`**: confirmar que el rol `anon` tenga `SELECT` sobre las vistas
   analíticas (`distribucion_participacion`, `formatos_populares`, `tematicas_emergentes`).
   `bitacoras_resumen` ya funcionaba desde el frontend viejo. Si una gráfica sale vacía,
   probablemente falte:
   ```sql
   grant select on distribucion_participacion, formatos_populares, tematicas_emergentes to anon;
   ```
2. **Datos reales**: hoy la BD trae colegios *placeholder* del seed. Cuando el profesor
   cargue datos reales, el sitio los muestra sin tocar código.
3. **Cobertura del diseño**: la maqueta habla de Fase 1/2/3, dilema y actores, pero la BD
   solo captura el **Encuentro 4 (preproducción)**. Los bloques sin respaldo en datos
   muestran estados vacíos elegantes en vez de contenido inventado.

El formulario de captura (data entry) sigue en el frontend viejo `frontend/` (React/Vite).
Este sitio es solo de **visualización** (lectura).
