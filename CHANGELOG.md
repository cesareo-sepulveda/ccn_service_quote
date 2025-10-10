# Changelog - CCN Service Quote

Todos los cambios notables de este módulo serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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