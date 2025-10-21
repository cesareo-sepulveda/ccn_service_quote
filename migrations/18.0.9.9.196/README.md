# Migración 18.0.9.9.196

## Problema Resuelto

Las líneas de cotización de rubros específicos de jardinería (como "Maquinaria de Jardinería") estaban guardándose con `service_type='limpieza'` en lugar de `service_type='jardineria'`.

Esto causaba que los tabs aparecieran en ROJO aunque tuvieran datos, porque el sistema JavaScript buscaba el campo `rubro_state_maquinaria_jardineria_jard` (que estaba en 0) mientras que el campo `rubro_state_maquinaria_jardineria_limp` tenía valor 1.

## Solución Implementada

### 1. Script de Migración (`post-migrate.py`)

Corrige automáticamente todas las líneas existentes con `service_type` incorrecto basándose en su `rubro_code`.

**Rubros corregidos automáticamente:**

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

### 2. Validación Automática en el Modelo (`quote_line_service_type_auto.py`)

Se agregaron métodos `create()` y `write()` que garantizan que:

- Nuevas líneas creadas con rubros específicos tengan el `service_type` correcto
- Si se cambia el `rubro_code` de una línea, su `service_type` se actualiza automáticamente
- Se respeta el `service_type` si viene explícitamente del contexto

## Cómo Aplicar

1. Actualiza el módulo desde Odoo:
   ```
   Aplicaciones → Cotizador Especial CCN → Actualizar
   ```

2. El script de migración se ejecutará automáticamente y mostrará en el log:
   ```
   === Iniciando corrección de service_type en líneas de cotización ===
   ✓ Corregidas X líneas de 'maquinaria_jardineria' -> service_type='jardineria'
   ...
   === Corrección completada ===
   ```

3. Refresca la página de la cotización y verifica que los tabs ahora muestren el color correcto

## Verificación

Después de actualizar, puedes verificar en la consola del navegador:

```javascript
__ccnProbe('maquinaria_jardineria')
```

Debería mostrar:
```
{jard: 1, limp: 0, gen: 1}  // En lugar de {jard: 0, limp: 1, gen: 1}
```

## Notas Técnicas

- La migración es **idempotente**: puede ejecutarse múltiples veces sin efectos secundarios
- Solo actualiza líneas que realmente necesitan corrección
- No afecta líneas de rubros compartidos (como "Mano de Obra", "Uniforme", "EPP", etc.)
