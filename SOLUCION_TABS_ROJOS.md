# Solución: Tabs Rojos con Datos (Problema de service_type)

## Problema Original

Los tabs de rubros específicos de jardinería (como "Maquinaria de Jardinería") aparecían en **ROJO** aunque tuvieran líneas guardadas.

### Causa Raíz

Las líneas de rubros específicos de jardinería estaban guardadas con `service_type='limpieza'` en lugar de `service_type='jardineria'`.

Esto causaba que:
- El JavaScript buscaba `rubro_state_maquinaria_jardineria_jard` (valor: 0 = rojo)
- Pero el sistema calculaba `rubro_state_maquinaria_jardineria_limp` (valor: 1 = verde)
- Resultado: Tab rojo aunque hubiera datos

### Diagnóstico

```javascript
// En consola del navegador
__ccnProbe('maquinaria_jardineria')

// ANTES (incorrecto):
{jard: 0, limp: 1, gen: 1}  // ❌ Tab rojo

// DESPUÉS (correcto):
{jard: 1, limp: 0, gen: 1}  // ✅ Tab verde
```

## Solución Implementada

### 1. Script de Migración Automática

**Ubicación:** `migrations/18.0.9.9.196/post-migrate.py`

- Se ejecuta automáticamente al actualizar el módulo
- Corrige todas las líneas existentes con `service_type` incorrecto
- Es idempotente (puede ejecutarse múltiples veces sin problemas)

**Rubros corregidos:**

**Jardinería:**
- `herramienta_menor_jardineria`
- `maquinaria_jardineria`
- `fertilizantes_tierra_lama`
- `consumibles_jardineria`
- `epp_alturas`

**Limpieza:**
- `material_limpieza`
- `maquinaria_limpieza`
- `equipo_especial_limpieza`

### 2. Validación Automática en Nuevas Líneas

**Ubicación:** `models/quote_line_service_type_auto.py`

Métodos `create()` y `write()` que garantizan:
- Nuevas líneas tengan el `service_type` correcto automáticamente
- Si se cambia el `rubro_code`, el `service_type` se actualiza
- Respeta valores explícitos del contexto

### 3. Método de Corrección Manual (Opcional)

**Ubicación:** `models/quote_fix_service_type.py`

Método `action_fix_service_type_all_lines()` disponible para ejecutar manualmente desde Python shell si es necesario:

```python
# Desde shell de Odoo
quote = env['ccn.service.quote'].browse(ID_COTIZACION)
quote.action_fix_service_type_all_lines()
```

## Cómo se Aplicó

1. **Permisos de carpeta migrations:**
   ```bash
   sudo chown -R 100:101 /home/admin/odoo-custom-addons/ccn_service_quote/migrations
   sudo chmod -R 755 /home/admin/odoo-custom-addons/ccn_service_quote/migrations
   docker restart odoo
   ```

2. **Actualización del módulo:**
   - Aplicaciones → Cotizador Especial CCN → Actualizar
   - El script de migración se ejecutó automáticamente

3. **Corrección manual de cotizaciones específicas:**
   - Se usó botón temporal "🔧 Corregir Service Type" (v18.0.9.9.197)
   - Botón removido en versión de producción (v18.0.9.9.198)

## Versiones

- **18.0.9.9.196:** Script de migración + validación automática
- **18.0.9.9.197:** + Botón temporal para corrección manual
- **18.0.9.9.198:** Versión producción (botón removido, método disponible para shell)

## Prevención Futura

El problema está resuelto permanentemente gracias a:

1. **Script de migración:** Corrige datos históricos al actualizar
2. **Validación en create/write:** Previene el problema en nuevas líneas
3. **Contexto correcto en vistas:** `default_service_type: current_service_type`

## Verificación

Para verificar que el problema está resuelto:

```javascript
// En consola del navegador, para cada rubro específico:
__ccnProbe('maquinaria_jardineria')
__ccnProbe('maquinaria_limpieza')
__ccnProbe('material_limpieza')
// etc.

// Resultado esperado para jardinería:
{jard: 1, limp: 0, gen: 1}  // ✅

// Resultado esperado para limpieza:
{jard: 0, limp: 1, gen: 1}  // ✅
```

---

**Fecha de implementación:** 2025-10-19
**Versión final:** 18.0.9.9.198
