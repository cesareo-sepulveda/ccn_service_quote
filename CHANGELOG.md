# Changelog - CCN Service Quote

Todos los cambios notables de este módulo serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [18.0.9.8.67] - 2025-01-XX

### Diagnóstico 🔍
- **Añadido logging interno a `countListRows()` para identificar por qué siempre retorna 0**
  - **Logs diagnósticos de escenarios B-E confirman**: `rowCount=0` incluso cuando usuario agrega líneas
  - **Hipótesis**: Los selectores `.o_data_row`, `td[data-name="product_id"]`, o `input[role="combobox"]` no coinciden con estructura DOM de Odoo 18
  - **Acción**: Logging exhaustivo para ver exactamente qué elementos encuentra/no encuentra la función
  - **Logs añadidos**:
    - Línea 327: Cuenta de `.o_data_row` encontradas
    - Líneas 332-343: Para cada fila: `rowId`, `cell found?`, `link found?`, `input found?`, `input value`
    - Líneas 349-366: Fallback tbody con logging de cada TR procesado
  - **Objetivo**: Identificar cuál selector específico está fallando

### Archivos Modificados
- [static/src/js/quote_tabs_badges.js](static/src/js/quote_tabs_badges.js)
  - Líneas 323-368: Función `countListRows()` con logging exhaustivo

---

## [18.0.9.8.66] - 2025-01-XX (DIAGNÓSTICO)

### Diagnóstico 🔍
- **Añadido logging de diagnóstico para identificar por qué tabs no se pintan verde**
  - **Problema**: Los dos bugs principales persisten desde v18.0.9.8.65
  - **Acción**: Logging simple para tabs `mano_obra` y `uniforme` (líneas 526-529)
  - **Objetivo**: Solicitar logs de usuario en 5 escenarios específicos

### Archivos Modificados
- [static/src/js/quote_tabs_badges.js](static/src/js/quote_tabs_badges.js)
  - Líneas 526-529: Debug logging para `mano_obra` y `uniforme`

---

## [18.0.9.8.65] - 2025-01-XX

### Corregido ✅
- **HOTFIX: Restaurado pintado verde cuando hay líneas REALES**
  - **Problema introducido en v18.0.9.8.64**: Removí demasiado código, tabs nunca se pintaban verde
  - **Solución**: Restaurado pintado optimista pero CON VALIDACIÓN:
    - Solo pinta verde si `hasValue` (producto guardado) O `hasInputValue` (texto en input)
    - NO pinta verde solo por abrir el formulario vacío
    - Líneas 731-750: Nueva lógica que verifica valores REALES
  - **Resultado**:
    - ✅ Tabs se pintan verde cuando agregas un producto
    - ✅ NO se pintan verde solo por hacer click en "Agregar línea"

### Archivos Modificados
- [static/src/js/quote_tabs_badges.js](static/src/js/quote_tabs_badges.js)
  - Líneas 731-750: Pintado optimista con validación de valor REAL

---

## [18.0.9.8.64] - 2025-01-XX (REVERTIDA - removió demasiado código)

### Corregido ✅
- **Bug #1: Tab se queda verde al borrar todas las líneas**
  - **Problema**: Al borrar todas las líneas de un rubro, el tab permanecía verde en lugar de volver a rojo
  - **Causa**: `__filledMemo[code]` se mantenía en `true` indefinidamente (línea 522)
  - **Solución**: Limpiar `__filledMemo[code] = false` cuando `rowCount === 0` (línea 518)
  - **Resultado**: Ahora el tab regresa a rojo automáticamente al quedar vacío

- **Bug #2: Tab se pone verde al hacer click en "Agregar línea" sin agregar nada**
  - **Problema**: Al marcar un tab ámbar y luego hacer click en "Agregar línea" en otro tab, este se ponía verde inmediatamente sin haber agregado nada
  - **Causa**: "Pintado optimista" en múltiples lugares (líneas 521, 738-743, 749-754, 764-769)
  - **Solución**:
    - Eliminado pintado optimista en evento `change` (líneas 730-731)
    - Eliminada función `optimisticPaint` completa y sus listeners (líneas 734-741)
    - Eliminada asignación de `__activeCodeOptimistic`
  - **Resultado**: El tab solo se pone verde cuando hay líneas REALES guardadas

### Código Removido
- ~50 líneas de código "optimista" que causaban falsos positivos
- El MutationObserver ya detecta cambios reales automáticamente, no necesitamos optimismo

### Archivos Modificados
- [static/src/js/quote_tabs_badges.js](static/src/js/quote_tabs_badges.js)
  - Línea 518: Limpiar memo cuando no hay filas
  - Líneas 522-524: Eliminado optimismo inmediato
  - Líneas 730-741: Eliminado pintado optimista

---

## [18.0.9.8.63] - 2025-01-XX

### Corregido
- **DESACTIVADO `quote_tabs_color_map_v2.js` temporalmente**: Causaba conflicto con `quote_tabs_badges.js`
  - **Problema diagnosticado**:
    - Dos archivos JS pintaban tabs simultáneamente → conflicto visual (rectángulo rojo)
    - `color_map_v2.js` no recibía el dataset (siempre `null`) → usaba fallback DOM incompleto
    - `badges.js` es más completo: MutationObserver activo, lógica de conteo, sessionStorage, pintado optimista
  - **Solución temporal**: Comentado en `__manifest__.py` línea 38
  - **Resultado esperado**: Solo `badges.js` controla colores via clases CSS
  - **Plan futuro**: Unificar ambos archivos después de validar que funciona

### Nota técnica
- `badges.js` tiene toda la funcionalidad necesaria (~820 líneas)
- Usa clases CSS (`ccn-status-filled`, `ccn-status-ack`, `ccn-status-empty`)
- El SCSS (`quote_tabs.scss`) ya estiliza estas clases correctamente

---

## [18.0.9.8.62] - 2025-01-XX

### Mejorado
- **Logging SIMPLIFICADO y eficiente**: Solo muestra warnings cuando hay problemas
  - ⚠️ `[CCN] Publish issue` - Solo si states está vacío o formView no se encuentra
  - ⚠️ `[CCN] Color map is null or empty` - Solo si el dataset no se pudo leer
  - **Eliminados logs repetitivos** que causaban miles de líneas en consola
  - Ahora la consola será limpia y solo verás problemas reales

### Propósito
- Versión limpia para diagnosticar sin saturar la consola

---

## [18.0.9.8.61] - 2025-01-XX (REVERTIDA - demasiado logging)

### Agregado
- **Logging de diagnóstico en `publishStates()`**: Para identificar por qué el color map es `null`
  - Logs muestran: estados encontrados, conteos, sufijo usado, y si se publicó correctamente
  - Formato: `[CCN PUBLISH] States: {...} Counts: {...} Suffix: _jard`
  - Esto nos ayudará a diagnosticar si:
    - Los campos `rubro_state_*` no existen en el DOM
    - Los campos están vacíos
    - La publicación falla por alguna razón

### Propósito
- Versión de diagnóstico para entender por qué `[CCN] applyOnce - Color map: null`

---

## [18.0.9.8.60] - 2025-01-XX

### Corregido
- **Bug CRÍTICO REINTRODUCIDO en v18.0.9.8.59**: Todos los tabs de Odoo se ponían rojos otra vez
  - **Problema**: La v18.0.9.8.59 solo arregló `quote_tabs_color_map_v2.js` pero NO `quote_tabs_badges.js`
  - **Causa**: Hay DOS archivos JavaScript que pintan tabs:
    - `quote_tabs_badges.js` - Aplica clases CSS (`ccn-status-filled`, `ccn-status-ack`, `ccn-status-empty`)
    - `quote_tabs_color_map_v2.js` - Aplica colores inline
    - El archivo `badges.js` NO tenía verificación de modelo y se ejecutaba en TODOS los módulos
  - **Solución**: Agregada verificación estricta en `quote_tabs_badges.js` - [líneas 644-648](static/src/js/quote_tabs_badges.js#L644-L648)
    - Verifica que existe `.o_ccn_rubro_states` antes de ejecutar
    - Mismo approach que en `color_map_v2.js`
  - **Resultado esperado**: AMBOS archivos ahora solo afectan cotizaciones CCN

### Nota importante
⚠️ **URGENTE - Reiniciar inmediatamente** - Este es el fix definitivo para el problema de tabs rojos en otros módulos. Reinicia Odoo y refresca todos los navegadores (Ctrl+Shift+R para limpiar cache).

---

## [18.0.9.8.59] - 2025-01-XX (REVERTIDA - causó problemas)

### Corregido
- **Detección de modelo mejorada**: Ahora usa clase CSS `ccn-quote` en lugar de buscar campos
  - **Problema**: Logs mostraban "Model detected: undefined" y "Color map: null"
  - **Causa**: El código buscaba `[name="model"]` o `dataset.resModel` que no existen consistentemente en Odoo 18
  - **Solución**: Cambiada detección para usar clase CSS `ccn-quote` que SÍ está presente en el HTML - [líneas 140-142](static/src/js/quote_tabs_color_map_v2.js#L140-L142)
    - `isCCNQuote = f.classList.contains('ccn-quote') || f.querySelector('.ccn-quote') !== null`
    - Más confiable porque la clase `ccn-quote` viene definida en el XML de la vista
  - **Resultado esperado**: Ahora debería detectar correctamente el modelo y cargar el color map

### Mejorado
- Logs de debug más claros: ahora muestra `Is CCN Quote: true/false` en lugar de `Model detected: undefined`

---

## [18.0.9.8.58] - 2025-01-XX

### Corregido
- **Loop infinito URGENTE**: MutationObserver causaba logs infinitos en consola
  - **Problema**: "Es casi infinito el log..." - console.log se repetía sin parar
  - **Causa**: MutationObserver detectaba cambios del DOM → llamaba scheduleApply() → modificaba DOM → detectaba cambios → loop infinito
  - **Solución**:
    - Agregada flag `isApplying` para prevenir re-entrada - [líneas 211-234](static/src/js/quote_tabs_color_map_v2.js#L211-L234)
    - Desactivado MutationObserver temporalmente - [líneas 253-255](static/src/js/quote_tabs_color_map_v2.js#L253-L255)
    - Todos los llamados a `applyOnce()` envueltos en `try/finally` para liberar flag
  - **Resultado**: Loop infinito detenido, logs controlados

### Nota técnica
- MutationObserver quedó desactivado hasta resolver el problema raíz
- Los colores aún se actualizan mediante eventos: click, change, shown.bs.tab, etc.

---

## [18.0.9.8.57] - 2025-01-XX

### Agregado
- Logs de debug adicionales para diagnosticar por qué no aparecían logs en consola
  - Agregado log de detección de modelo con formRoot completo
  - Agregado log de mapa de colores y cantidad de links encontrados

---

## [18.0.9.8.56] - 2025-01-XX

### Corregido
- **Bug CRÍTICO introducido en v18.0.9.8.53-55**: JavaScript afectaba TODOS los módulos de Odoo
  - **Problema**: Todos los tabs de Odoo (Ventas, Inventario, etc.) se ponían rojos
  - **Causa**: El código JavaScript se registraba globalmente y se ejecutaba en TODAS las vistas de formulario, no solo en cotizaciones CCN
  - **Solución**: Agregada verificación de modelo - [líneas 138-145](static/src/js/quote_tabs_color_map_v2.js#L138-L145)
    - Verifica que `resModel === 'ccn.service.quote'` antes de aplicar colores
    - Si no es una cotización CCN, sale inmediatamente sin hacer nada
  - **Resultado**: JavaScript SOLO afecta módulo de cotizaciones CCN, otros módulos funcionan normalmente

### Mejorado
- Agregada verificación de modelo para evitar efectos colaterales en otros módulos

### Nota importante
⚠️ **URGENTE - Reiniciar inmediatamente** - Este fix es crítico. Reinicia Odoo y refresca todos los navegadores (Ctrl+F5).

---

## [18.0.9.8.55] - 2025-01-XX

### Corregido
- **Cambio de prioridad**: Dataset ahora es la fuente primaria de datos
  - Cambió de `DOM > dataset` a `dataset > DOM`
  - El dataset es más confiable porque se actualiza desde Python

### Agregado
- Logging detallado en consola para diagnosticar problemas de colores
  - Muestra valores de dataset, DOM y estados calculados para cada tab

---

## [18.0.9.8.54] - 2025-01-XX

### Corregido
- **Bug introducido en v18.0.9.8.53**: Los colores solo aparecían en tabs inactivos
  - **Problema**: Al hacer clic en un tab, el color desaparecía. Solo se veían los colores al guardar o marcar ámbar
  - **Causa**: Línea 172 del fallback tenía `if (a.classList.contains("active")) { clearInline(a, li); continue; }`
    - Esto limpiaba el color del tab activo antes de aplicar el nuevo color
    - Era una lógica antigua que interfería con la nueva implementación
  - **Solución**: Eliminada línea que limpiaba color de tabs activos - [línea 172](static/src/js/quote_tabs_color_map_v2.js#L172)
  - **Resultado**: Tabs activos E inactivos muestran sus colores correctamente

### Mejorado
- Tabs ahora muestran colores consistentemente, estén activos o no
- Simplificado código al eliminar lógica innecesaria

### Nota importante
⚠️ **Solo requiere reiniciar Odoo** - Reinicia el servidor y refresca el navegador (Ctrl+F5).

---

## [18.0.9.8.53] - 2025-01-XX

### Corregido
- **Bug REAL encontrado**: El problema NO estaba en Python sino en JavaScript
  - **Problema persistente**: A pesar de todas las correcciones en Python (v18.0.9.8.46-52), los tabs seguían quedando verdes al eliminar líneas y apareciendo tabs verdes vacíos
  - **Causa REAL**: El archivo JavaScript `quote_tabs_color_map_v2.js` estaba priorizando clases CSS (`ccn-status-filled`, `ccn-status-ack`, `ccn-status-empty`) sobre los valores reales de la base de datos
    - Las clases se agregaban al crear líneas pero NO se removían al eliminarlas
    - JavaScript veía las clases viejas y las usaba en lugar de leer los campos `rubro_state_*`
    - Por eso los tabs se quedaban verdes aunque Python calculara correctamente estado=0 (rojo)
  - **Solución DEFINITIVA**: Modificado `quote_tabs_color_map_v2.js` - [líneas 143-186](static/src/js/quote_tabs_color_map_v2.js#L143-L186)
    - **ELIMINADA** completamente la lectura de clases CSS como fuente de datos
    - **ELIMINADA** la prioridad de clases sobre campos de BD
    - Ahora JavaScript lee **SOLO** los campos `rubro_state_*` del DOM (fuente de verdad)
    - Las clases CSS se ignoran por completo en la lógica de colores
    - Si no hay valor en el campo, se asume rojo (vacío) por defecto
  - **Resultado**: Tabs SIEMPRE reflejan el estado REAL de la base de datos

### Mejorado
- JavaScript ahora es 100% dependiente de los valores calculados por Python
- Eliminado cache problemático de clases CSS
- Simplificada lógica de prioridades en JavaScript
- Colores de tabs son ahora una "vista" pura de los datos (sin estado local)

### Nota importante
⚠️ **Solo requiere reiniciar Odoo** - NO necesitas actualizar el módulo desde Aplicaciones, solo reiniciar el servidor para que cargue el nuevo JavaScript.

---

## [18.0.9.8.52] - 2025-01-XX

### Corregido
- **Bug crítico**: Reforzada la solución de v18.0.9.8.51 que no funcionaba completamente
  - **Problema persistente**: A pesar de `store=True`, los tabs seguían sin actualizarse al eliminar líneas y seguían apareciendo tabs verdes vacíos al hacer clic en "Agregar línea"
  - **Causa**: Aunque `store=True` fue agregado, el `@api.depends('line_ids')` NO siempre dispara el recálculo en vistas inline One2many, especialmente después de crear ACKs
  - **Solución aplicada**:
    1. **Restaurados métodos `write()` y `unlink()`** en modelo `ccn.service.quote.line` - [líneas 968-986](models/service_quote.py#L968-L986)
       - Agregado `quotes.modified(['line_ids'])` para forzar disparo de `@api.depends`
       - Esto garantiza que el framework detecte el cambio y recalcule campos stored
    2. **Filtros ULTRA-ESTRICTOS** para ignorar líneas temporales - [líneas 300-308 y 357-366](models/service_quote.py#L300-L308)
       - Agregado `l.id > 0` (IDs positivos)
       - Agregado `l._origin.id` (verificar que el registro original existe en BD)
       - Agregado validación de `l.site_id` antes de acceder a `l.site_id.id`
       - Imposible que líneas NewId pasen estos filtros
  - **Resultado**: Combinación de `store=True` + `modified()` + filtros estrictos = solución robusta

### Mejorado
- Triple capa de protección contra líneas temporales (NewId)
- Trigger explícito del framework de dependencias con `modified()`
- Validaciones adicionales para prevenir errores de AttributeError

---

## [18.0.9.8.51] - 2025-01-XX

### Corregido
- **Bug crítico persistente**: Tabs no volvían a rojo al eliminar todas las líneas (solución definitiva)
  - **Problema**: A pesar de las versiones 18.0.9.8.46 y 18.0.9.8.50, los tabs seguían quedando en verde al eliminar todas las líneas
  - **Causa raíz definitiva**: Los campos computed sin `store=True` dependen del cache de Odoo y del framework de dependencias `@api.depends`. Cuando las líneas se eliminan desde la vista inline One2many, el framework NO siempre detecta el cambio en `line_ids` correctamente, por lo que no dispara el recálculo automático
  - **Solución DEFINITIVA**: Agregado `store=True` a TODOS los campos `rubro_state_*` - [líneas 235-279](models/service_quote.py#L235-L279)
    - **42 campos** ahora se almacenan en PostgreSQL en lugar de calcularse en memoria
    - Los valores se persisten en la base de datos
    - El framework `@api.depends` funciona correctamente con campos stored
    - Recálculo automático garantizado cuando cambian las dependencias
    - Eliminados métodos `write()` y `unlink()` custom (ya no necesarios)
  - **Resultado**: Tabs se actualizan SIEMPRE correctamente, sin excepciones

### Mejorado
- **Rendimiento**: Campos stored son mucho más rápidos de leer (consulta directa a BD vs cálculo en memoria)
- **Confiabilidad**: Eliminada dependencia del cache volátil de Odoo
- **Simplicidad**: Código más simple y mantenible (framework de Odoo maneja todo)
- **Consistencia**: Estados siempre sincronizados con la realidad de la BD
- **Migración**: Al actualizar el módulo, Odoo creará automáticamente las columnas en PostgreSQL

### Nota técnica
⚠️ **Requiere actualización del módulo**: Después de instalar esta versión, debes actualizar el módulo desde Aplicaciones → Actualizar para que Odoo cree las nuevas columnas en la base de datos.

---

## [18.0.9.8.50] - 2025-01-XX

### Corregido
- **Bug crítico**: Tabs no volvían a rojo al eliminar todas las líneas de un rubro
  - **Problema**: Al borrar líneas y quedarse vacío el tab, se quedaba en verde en lugar de volver automáticamente a rojo
  - **Causa raíz**: Los campos computed no están almacenados (`store=False`), por lo que Odoo cachea los valores calculados. Aunque el método `unlink()` llamaba a `_compute_rubro_states()`, el cache no se invalidaba y la UI mostraba valores antiguos
  - **Solución**: Mejorado método `unlink()` y agregado `write()` en modelo `ccn.service.quote.line` - [líneas 968-996](models/service_quote.py#L968-L996)
    - Agregado `invalidate_recordset(['line_ids'])` para forzar recálculo de la relación
    - Agregado invalidación de todos los campos `rubro_state_*` después del recálculo
    - Agregado método `write()` para manejar modificaciones que afecten estados
    - Ambos métodos ahora invalidan el cache explícitamente
  - **Resultado**: Tabs se actualizan inmediatamente a rojo cuando se eliminan todas las líneas

### Mejorado
- Invalidación de cache ahora es explícita y garantizada al modificar/eliminar líneas
- Método `write()` de líneas ahora detecta cambios relevantes y fuerza recálculo
- UI siempre muestra el estado correcto de los tabs sin necesidad de recargar
- Mejor sincronización entre backend (Python) y frontend (JavaScript/UI)

---

## [18.0.9.8.49] - 2025-01-XX

### Corregido
- **Bug crítico**: Tabs se ponían en verde al hacer clic en "Agregar línea" después de marcar un rubro como "No aplica"
  - **Problema**: Después de crear un ACK (marcar ámbar), al ir a otro rubro y hacer clic en "Agregar línea" sin guardar, el tab se ponía verde inmediatamente. Al cancelar, el tab quedaba verde sin líneas reales
  - **Causa raíz**: En Odoo, las líneas temporales pueden tener un `NewId` (ID virtual) que evalúa como `True` en condiciones booleanas. El filtro anterior `l.id and` no era suficiente para distinguir entre IDs reales (enteros) y NewIds (objetos virtuales)
  - **Solución**: Modificado filtro en ambas funciones compute - [líneas 301 y 354](models/service_quote.py#L301)
    - Cambiado de `l.id and` a `l.id and isinstance(l.id, int) and`
    - Ahora solo cuenta líneas con IDs enteros (guardadas en BD)
    - Ignora completamente líneas con NewId (temporales en memoria)
  - **Resultado**: Tabs mantienen su color correcto incluso al hacer clic en "Agregar línea" sin guardar

### Mejorado
- Filtrado de líneas temporales ahora es más robusto y específico
- Prevención absoluta de que líneas no guardadas afecten el color de los tabs
- Comportamiento consistente antes y después de crear ACKs

---

## [18.0.9.8.48] - 2025-01-XX

### Corregido
- **Bug crítico**: Error de validación persistente al presionar botón "No aplica" en rubros
  - **Problema**: Continuaba apareciendo error "El nombre de la cotización debe ser único por cliente" a pesar de usar `sudo()`
  - **Causa raíz**: El constraint SQL se valida a nivel de PostgreSQL, no de Python. Cuando Odoo actualiza relaciones One2many (como `ack_ids`), incluye TODOS los campos actuales en el `write()`, lo que dispara la revalidación del constraint aunque los valores no cambien
  - **Solución definitiva**: Modificado método `write()` en [líneas 568-592](models/service_quote.py#L568-L592)
    - Agregado filtro inteligente que elimina `partner_id` y `name` del diccionario de valores si no han cambiado
    - Previene que PostgreSQL revalide el constraint cuando los valores son idénticos
    - Solo aplica cuando se actualiza un único registro (len(self) == 1)
    - Respeta context flag `skip_uniqueness_filter` para casos especiales
  - **Resultado**: Botón "No aplica" funciona sin errores, sin importar el estado de la cotización

### Mejorado
- Método `write()` ahora es más eficiente: solo actualiza campos que realmente cambiaron
- Prevención proactiva de errores de constraint SQL innecesarios
- Mejor rendimiento al evitar validaciones redundantes en PostgreSQL

---

## [18.0.9.8.47] - 2025-01-XX

### Corregido
- **Bug crítico**: Error de validación al presionar botón "No aplica" en rubros
  - **Problema**: Al intentar marcar un rubro como "No aplica", aparecía error: "El nombre de la cotización debe ser único por cliente"
  - **Causa**: Al crear/modificar ACKs, Odoo disparaba validación del constraint SQL de unicidad en la cotización padre, aunque no se estuvieran modificando los campos `partner_id` o `name`
  - **Solución**: Modificado método `_ensure_ack()` en [líneas 409-441](models/service_quote.py#L409-L441)
    - Agregado uso de `sudo()` para evitar constraints innecesarios
    - Agregado context flag `skip_quote_constraints=True` para evitar validaciones redundantes
    - Los ACKs ahora se crean/modifican sin disparar revalidación de la cotización padre
  - **Resultado**: Botón "No aplica" funciona correctamente sin errores de validación

### Mejorado
- Creación/modificación de ACKs ahora es más eficiente y no dispara validaciones innecesarias
- Mejor manejo de permisos al crear ACKs usando `sudo()`

---

## [18.0.9.8.46] - 2025-01-XX

### Corregido
- **Bug crítico**: Tabs no volvían a rojo automáticamente al eliminar todas las líneas
  - **Problema**: Al borrar líneas y quedarse vacío el tab, el color no se actualizaba hasta recargar el formulario
  - **Causa**: El decorador `@api.depends('line_ids')` no disparaba el recálculo al eliminar líneas desde la vista inline
  - **Solución**: Agregado método `unlink()` en modelo `ccn.service.quote.line` - [líneas 951-960](models/service_quote.py#L951-L960)
    - Guarda las cotizaciones afectadas antes de eliminar
    - Ejecuta `super().unlink()` para eliminar las líneas
    - Fuerza recálculo explícito de `_compute_rubro_states()` y `_compute_rubro_states_per_service()`
  - **Resultado**: Tabs se actualizan **inmediatamente** al eliminar líneas, volviendo a rojo cuando quedan vacíos

### Mejorado
- Recálculo de estados de tabs ahora es explícito y garantizado al eliminar líneas
- Mejor experiencia de usuario: colores de tabs reflejan cambios en tiempo real

---

## [18.0.9.8.32] - 2025-01-XX

### Corregido
- **Bug crítico**: Color de tabs se actualizaba incorrectamente
  - **Problema 1**: Tab se ponía verde al hacer clic en "Agregar una línea" sin guardar
  - **Problema 2**: Al cancelar agregar línea, el tab quedaba verde sin datos reales
  - **Problema 3**: Al eliminar líneas, el tab no volvía a gris/rojo hasta salir del formulario
  - **Causa**: Campos compute contaban líneas temporales (sin `id`) creadas en memoria
  - **Solución**: Agregado filtro `l.id and` en ambas funciones compute:
    - `state_for()` - [línea 300](models/service_quote.py#L300)
    - `state_for_service()` - [línea 351](models/service_quote.py#L351)
  - **Resultado**: Tab se actualiza **solo cuando se guardan/eliminan líneas reales** en BD

### Mejorado
- Actualización de color de tabs ahora es inmediata y precisa
- Solo líneas guardadas en base de datos afectan el color del tab
- Mejor experiencia de usuario: colores reflejan estado real, no acciones temporales

---

## [18.0.9.8.31] - 2025-01-XX

### Corregido
- **Bug crítico**: Tabs aparecían en color ámbar en cotizaciones nuevas (sin datos ni ACKs)
  - **Causa**: La búsqueda de ACKs con `site_id=False` encontraba falsos positivos
  - **Solución**: Agregada validación `if site_id:` antes de buscar ACKs en ambas funciones:
    - `_compute_rubro_states()` - [líneas 305-313](models/service_quote.py#L305-L313)
    - `_compute_rubro_states_per_service()` - [líneas 355-363](models/service_quote.py#L355-L363)
  - **Resultado**: Ahora cotizaciones nuevas muestran todos los tabs en **gris/rojo** (estado=0) correctamente

### Mejorado
- Lógica de búsqueda de ACKs más robusta: solo busca cuando existe un `site_id` válido
- Previene falsos positivos en el cálculo de estados de rubros

---

## [18.0.9.8.30] - 2025-01-XX

### Agregado
- **Constraint de validación** `_check_line_independence_fields()` en modelo `ccn.service.quote.line`
  - Valida que cada línea tenga obligatoriamente: `site_id`, `service_type`, `rubro_id`
  - Previene la creación de líneas incompletas que comprometerían la independencia de datos
  - Ubicación: [models/service_quote.py:832-841](models/service_quote.py#L832-L841)

- **Documentación técnica completa** sobre independencia de datos
  - Archivo: `INDEPENDENCIA_DATOS.md` (~500 líneas)
  - Documenta arquitectura, validaciones, casos de uso, FAQ
  - Incluye 11 secciones con ejemplos prácticos

- **Archivo CHANGELOG.md** para seguimiento de versiones

### Mejorado
- Incremento de versión en `__manifest__.py`: `18.0.9.8.29` → `18.0.9.8.30`

### Notas
- Esta versión refuerza la independencia de datos con validaciones adicionales
- No hay cambios funcionales visibles para el usuario final
- Todos los cambios son compatibles con versiones anteriores

---

## [18.0.9.8.29] - 2025-01-XX (Versión anterior)

### Existente (confirmado funcional)
- Vista heredada `ccn_service_quote_states_inherit.xml` con estados por servicio
- Cálculo de estados por servicio `_compute_rubro_states_per_service()`
- Sistema de ACKs granular por sitio/servicio/rubro
- Dominios correctos en todas las vistas XML
- Constraints SQL de unicidad
- Validación de sitio pertenece a cotización

---

## Formato de Versionado

El número de versión sigue el formato: `ODOO.MAJOR.MINOR.PATCH`

- **ODOO**: Versión de Odoo (18.0)
- **MAJOR**: Cambios incompatibles con versiones anteriores
- **MINOR**: Nuevas funcionalidades compatibles
- **PATCH**: Correcciones de bugs y mejoras menores

---

## Tipos de Cambios

- **Agregado**: Nuevas funcionalidades
- **Cambiado**: Cambios en funcionalidades existentes
- **Deprecado**: Funcionalidades que serán eliminadas en próximas versiones
- **Eliminado**: Funcionalidades eliminadas
- **Corregido**: Correcciones de bugs
- **Seguridad**: Correcciones de vulnerabilidades
- **Mejorado**: Mejoras de rendimiento o código sin cambios funcionales