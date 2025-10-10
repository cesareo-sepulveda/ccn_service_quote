# Changelog - CCN Service Quote

Todos los cambios notables de este módulo serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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