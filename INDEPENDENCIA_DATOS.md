# Documentación Técnica: Independencia de Datos en CCN Service Quote

## Versión del módulo: 18.0.9.8.30

---

## 1. Arquitectura de Independencia

El módulo `ccn_service_quote` garantiza la **independencia total de datos** en múltiples niveles:

```
Cliente (res.partner)
  └── Service Quote (ccn.service.quote) [nombre único por cliente]
      └── Sitio (ccn.service.quote.site) [≥1, ej: "General", "Bodega", "Oficina Central"]
          └── Tipo de Servicio (jardineria | limpieza | mantenimiento | etc.)
              └── Rubro (mano_obra | uniforme | epp | etc.)
                  └── Líneas (ccn.service.quote.line) [productos y cantidades]
```

### **Regla de Oro de Independencia:**
> **Cada línea (`ccn.service.quote.line`) DEBE tener:**
> - `quote_id` → A qué cotización pertenece
> - `site_id` → En qué sitio está
> - `service_type` → Qué tipo de servicio representa
> - `rubro_id` → A qué rubro/categoría pertenece

**La combinación de estos 4 campos garantiza la separación total de datos.**

---

## 2. Niveles de Independencia

### **Nivel 1: Cliente → Service Quotes**
- **Constraint SQL**: `ccn_service_quote_partner_name_uniq`
- **Regla**: Un cliente puede tener muchas cotizaciones, pero la dupla `(partner_id, name)` debe ser única
- **Ejemplo válido**:
  ```
  Cliente: "ACME Corp"
    - Quote: "Cotización 2025-01"
    - Quote: "Cotización 2025-02"
    - Quote: "Proyecto Especial Planta Norte"
  ```

### **Nivel 2: Service Quote → Sitios**
- **Constraint**: Al menos un sitio por quote (auto-creado: "General")
- **Regla**: Los datos de un sitio NO pueden verse/mezclarse con datos de otro sitio
- **Implementación**:
  - Todas las vistas filtran por `site_id = current_site_id`
  - Los cálculos de estado usan `_site_for_compute()` para determinar el sitio activo
- **Ejemplo**:
  ```
  Quote: "Servicio Empresa XYZ"
    - Sitio: "General"
      → líneas aquí NO se mezclan con...
    - Sitio: "Bodega 1"
      → líneas aquí NO se mezclan con...
    - Sitio: "Oficina Central"
      → líneas aquí
  ```

### **Nivel 3: Sitio → Tipos de Servicio**
- **Constraint**: Tipo de servicio requerido en cada línea (`_check_line_independence_fields`)
- **Regla**: Los datos de "Jardinería" NO pueden verse/mezclarse con "Limpieza", aunque estén en el mismo sitio
- **Implementación**:
  - Campos One2many separados por servicio: `line_ids_mano_obra_jardineria` vs `line_ids_mano_obra_limpieza`
  - Dominios en vistas filtran por `service_type = current_service_type`
  - Estados calculados por servicio: `rubro_state_XXX_jard` vs `rubro_state_XXX_limp`
- **Ejemplo**:
  ```
  Sitio: "General"
    - Jardinería:
      → Rubro Mano de Obra: 5 jardineros
    - Limpieza:
      → Rubro Mano de Obra: 3 operarios de limpieza

  [Estos 5 y 3 NO se mezclan NI suman, son totalmente independientes]
  ```

### **Nivel 4: Tipo de Servicio → Rubros**
- **Constraint**: Rubro requerido en cada línea (`_check_line_independence_fields`)
- **Regla**: Los productos de "Mano de Obra" NO se mezclan con "Uniforme"
- **Implementación**:
  - Cada pestaña (page) del notebook filtra por `rubro_id.code = 'XXX'`
  - Estados calculados por rubro: `_compute_rubro_states_per_service()`
- **Ejemplo**:
  ```
  Jardinería en Sitio "General":
    - Mano de Obra: Jardinero Senior, Jardinero Junior
    - Uniforme: Camisa, Pantalón, Gorra
    - EPP: Guantes, Lentes de seguridad

  [Cada rubro se ve/edita/calcula independientemente]
  ```

---

## 3. Validaciones Implementadas

### **3.1 Constraints SQL**
```python
# En ccn.service.quote
_sql_constraints = [
    ('ccn_service_quote_partner_name_uniq', 'unique(partner_id, name)',
     'El nombre de la cotización debe ser único por cliente.')
]

# En ccn.service.quote.site
_sql_constraints = [
    ('ccn_quote_site_unique_name_per_quote', 'unique(quote_id, name)',
     'El nombre del sitio debe ser único por cotización.')
]

# En ccn.service.quote.ack
_sql_constraints = [
    ('ccn_ack_unique_scope', 'unique(quote_id, site_id, service_type, rubro_code)',
     'Solo puede existir un ACK por sitio, tipo de servicio y rubro.')
]
```

### **3.2 Constraints Python**
```python
# En ccn.service.quote.line

@api.constrains('site_id', 'quote_id')
def _check_site_belongs_to_quote(self):
    """El sitio de la línea DEBE pertenecer a la misma cotización."""
    for line in self:
        if line.site_id and line.quote_id and line.site_id.quote_id:
            if line.site_id.quote_id != line.quote_id:
                raise ValidationError("El sitio de la línea pertenece a otra cotización.")

@api.constrains('site_id', 'service_type', 'rubro_id', 'quote_id')
def _check_line_independence_fields(self):
    """Valida que las líneas tengan todos los campos necesarios para independencia."""
    for line in self:
        if not line.site_id:
            raise ValidationError("Cada línea debe tener un sitio asignado.")
        if not line.service_type:
            raise ValidationError("Cada línea debe tener un tipo de servicio asignado.")
        if not line.rubro_id:
            raise ValidationError("Cada línea debe tener un rubro asignado.")
```

---

## 4. Sistema de Estados por Rubro (Colores en Pestañas)

### **4.1 Lógica de Estados**
Cada pestaña (tab/rubro) puede tener 3 estados visuales:

| Estado | Valor | Color | Significado |
|--------|-------|-------|-------------|
| **VERDE** | 1 | Verde | El rubro tiene al menos 1 línea de producto |
| **ÁMBAR** | 2 | Amarillo/Naranja | El usuario marcó "No Aplica" conscientemente |
| **GRIS** | 0 | Gris | El rubro está vacío (sin líneas, sin ACK) |

### **4.2 Cálculo de Estados**
Existen **DOS** funciones de cálculo:

#### **A) Estados genéricos** (`_compute_rubro_states()`)
- **Campos**: `rubro_state_mano_obra`, `rubro_state_uniforme`, etc.
- **Filtros**: `site_id` + `rubro_code` (SIN filtrar por `service_type`)
- **Uso**: JavaScript legacy, backward compatibility

#### **B) Estados por servicio** (`_compute_rubro_states_per_service()`) ✅ **RECOMENDADO**
- **Campos**:
  - Jardinería: `rubro_state_mano_obra_jard`, `rubro_state_uniforme_jard`, etc.
  - Limpieza: `rubro_state_mano_obra_limp`, `rubro_state_uniforme_limp`, etc.
- **Filtros**: `site_id` + `service_type` + `rubro_code`
- **Uso**: Vistas XML (`ccn_service_quote_states_inherit.xml`)

**Código clave**:
```python
def state_for_service(rec, code, service_type):
    site_id = _site_for_compute(rec)
    # Filtrar líneas por sitio + servicio + rubro
    lines = rec.line_ids.filtered(lambda l:
        (not site_id or l.site_id.id == site_id) and
        l.service_type == service_type and  # ← CLAVE: independencia por servicio
        ((getattr(l, 'rubro_code', False) or ...) == code)
    )
    cnt = len(lines)

    # Buscar ACKs para este sitio + servicio + rubro
    ack = self.env['ccn.service.quote.ack'].search_count([
        ('quote_id', '=', rec.id),
        ('site_id', '=', site_id),
        ('service_type', '=', service_type),  # ← CLAVE: ACK granular
        ('rubro_code', '=', code),
        ('is_empty', '=', True),
    ]) > 0

    return 1 if cnt > 0 else (2 if ack else 0)
```

---

## 5. Sistema de ACKs ("No Aplica")

### **5.1 ¿Qué es un ACK?**
Un **ACK** (Acknowledgement) es un registro que indica:
> "El usuario confirma que este rubro NO aplica para este sitio/servicio, y que esto es intencional (no un olvido)."

### **5.2 Granularidad de ACKs**
Cada ACK tiene **4 claves** únicas:
1. `quote_id` → Cotización
2. `site_id` → Sitio
3. `service_type` → Tipo de servicio
4. `rubro_code` → Rubro

**Constraint SQL garantiza unicidad:**
```sql
unique(quote_id, site_id, service_type, rubro_code)
```

### **5.3 Flujo de ACKs**
```
1. Usuario abre: Quote "XYZ" → Sitio "General" → Servicio "Jardinería" → Rubro "EPP Alturas"
2. Tab está GRIS (estado = 0)
3. Usuario presiona botón "No Aplica"
4. Sistema crea ACK:
   {
     quote_id: 123,
     site_id: 456,
     service_type: 'jardineria',
     rubro_code: 'epp_alturas',
     is_empty: True
   }
5. Tab cambia a ÁMBAR (estado = 2)
6. Sistema recalcula: _compute_rubro_states_per_service()
```

**Si el usuario cambia a Servicio "Limpieza":**
- El ACK de Jardinería NO afecta
- El tab de "EPP Alturas" en Limpieza estará GRIS (estado = 0)
- Puede presionar "No Aplica" nuevamente → crea ACK independiente para Limpieza

---

## 6. Dominios y Filtros en Vistas

### **6.1 Ejemplo: Mano de Obra en Jardinería**
```xml
<field name="line_ids_mano_obra_jardineria" mode="list"
       invisible="current_service_type != 'jardineria'"
       context="{
         'default_quote_id': id,
         'default_site_id': current_site_id,
         'default_service_type': current_service_type,
         'ctx_rubro_code': 'mano_obra',
       }"
       domain="[
         ('rubro_id.code','=','mano_obra'),
         ('service_type','=','jardineria'),
         ('site_id','=', current_site_id)
       ]"/>
```

**Explicación de los filtros:**
- `domain`: Filtra **qué líneas SE MUESTRAN** en la tabla
  - Solo líneas con `rubro_id.code = 'mano_obra'`
  - Solo líneas con `service_type = 'jardineria'`
  - Solo líneas del sitio actual (`current_site_id`)

- `context`: Define **valores por defecto** al crear nuevas líneas
  - Nueva línea heredará: quote, sitio, servicio, rubro automáticamente

**Resultado:** Independencia garantizada visualmente y lógicamente.

---

## 7. Casos de Uso y Ejemplos

### **Caso 1: Dos sitios, un servicio**
```
Cliente: "Hotel Gran Plaza"
Quote: "Mantenimiento 2025"

  Sitio: "General"
    - Jardinería:
      - Mano de Obra: Jardinero (cantidad: 2)
      - Uniforme: Camisa (cantidad: 4)

  Sitio: "Área Recreativa"
    - Jardinería:
      - Mano de Obra: Jardinero Senior (cantidad: 1)
      - Fertilizantes: Abono Orgánico (cantidad: 50 kg)
```

**¿Se mezclan los datos?** ❌ NO
- Cambiar `current_site_id` filtra completamente las vistas
- Estados se calculan independientemente por sitio
- Los totales del Sitio "General" NO incluyen datos de "Área Recreativa"

---

### **Caso 2: Un sitio, dos servicios**
```
Cliente: "Oficinas Corporativas S.A."
Quote: "Servicios Integrales 2025"
Sitio: "General"

  - Jardinería:
    - Mano de Obra: Jardinero (3)
    - Herramienta Menor: Pala, Rastrillo

  - Limpieza:
    - Mano de Obra: Operario de Limpieza (5)
    - Material de Limpieza: Desinfectante, Trapeador
```

**¿Se mezclan los datos?** ❌ NO
- Cambiar `current_service_type` de "jardineria" a "limpieza":
  - Pestañas muestran líneas filtradas por `service_type`
  - Estados calculados con `_compute_rubro_states_per_service()`
  - Los 3 jardineros NO se suman con los 5 operarios de limpieza

---

### **Caso 3: Dos sitios, dos servicios (máxima complejidad)**
```
Cliente: "Complejo Industrial Norte"
Quote: "Servicios Generales"

  Sitio: "Planta de Producción"
    - Jardinería:
      - Mano de Obra: 2 jardineros
    - Limpieza:
      - Mano de Obra: 10 operarios

  Sitio: "Oficinas Administrativas"
    - Jardinería:
      - Mano de Obra: 1 jardinero
    - Limpieza:
      - Mano de Obra: 3 operarios
```

**Total de combinaciones independientes:** 4
1. Planta/Jardinería → 2 jardineros
2. Planta/Limpieza → 10 operarios
3. Oficinas/Jardinería → 1 jardinero
4. Oficinas/Limpieza → 3 operarios

**Cada combinación es totalmente independiente:**
- Tiene sus propias líneas
- Tiene sus propios estados de rubro
- Tiene sus propios ACKs (si se marca "No Aplica")
- Tiene sus propios cálculos de totales

---

## 8. Checklist de Independencia

Para verificar que la independencia funciona correctamente:

- [ ] **Constraint SQL** en `ccn.service.quote`: `partner_id + name` únicos
- [ ] **Constraint SQL** en `ccn.service.quote.site`: `quote_id + name` únicos
- [ ] **Constraint SQL** en `ccn.service.quote.ack`: `quote_id + site_id + service_type + rubro_code` únicos
- [ ] **Constraint Python** en líneas: `_check_site_belongs_to_quote()` valida sitio pertenece a quote
- [ ] **Constraint Python** en líneas: `_check_line_independence_fields()` valida presencia de site/service/rubro
- [ ] **Dominios en vistas** filtran por `site_id = current_site_id`
- [ ] **Dominios en vistas** filtran por `service_type = current_service_type`
- [ ] **Dominios en vistas** filtran por `rubro_id.code = 'XXX'`
- [ ] **Estados calculados** usan `_compute_rubro_states_per_service()` (no la versión genérica)
- [ ] **Botones "No Aplica"** usan estados por servicio: `rubro_state_XXX_jard` / `rubro_state_XXX_limp`
- [ ] **Contextos en vistas** pasan `default_site_id`, `default_service_type`, `ctx_rubro_code`
- [ ] **ACKs se crean** con granularidad `quote + site + service + rubro`

---

## 9. Cambios Recientes (v18.0.9.8.30)

### ✅ **Agregado:**
1. Constraint `_check_line_independence_fields()` en [service_quote.py:832-841](service_quote.py#L832-L841)
   - Valida que cada línea tenga: `site_id`, `service_type`, `rubro_id`
   - Previene creación de líneas incompletas que romperían independencia

2. Documentación técnica completa (este archivo)

### 🔄 **Ya existía (confirmado funcional):**
1. Vista heredada `ccn_service_quote_states_inherit.xml` que usa estados por servicio
2. Cálculo de estados por servicio `_compute_rubro_states_per_service()`
3. Sistema de ACKs granular por sitio/servicio/rubro
4. Dominios correctos en todas las vistas XML

---

## 10. Preguntas Frecuentes

### **P: ¿Los rubros son compartidos o independientes por servicio?**
**R:** Los **rubros** (modelo `ccn.service.rubro`) son registros compartidos en la BD. El **mismo rubro "mano_obra"** se usa tanto para Jardinería como para Limpieza. La independencia se logra a nivel de **líneas**, donde cada línea tiene su propio `service_type`.

**No es un problema** porque el rubro es solo un "contenedor lógico". La separación real está en las líneas.

---

### **P: ¿Qué pasa si cambio de sitio mientras estoy editando?**
**R:** Al cambiar `current_site_id`:
1. Odoo recalcula todos los campos computados (`_compute_rubro_states_per_service`, etc.)
2. Las vistas aplican dominios automáticamente → muestran solo líneas del nuevo sitio
3. Los estados de pestañas reflejan el nuevo sitio
4. NO se pierden datos, solo cambia el filtro visual

---

### **P: ¿Puedo eliminar accidentalmente líneas de otro sitio/servicio?**
**R:** ❌ **NO**, siempre que uses la interfaz estándar:
- Los dominios en vistas solo muestran líneas del sitio/servicio actual
- No puedes "ver" líneas de otros sitios/servicios desde la UI
- Los constraints validan que toda operación sea coherente

**Riesgo:** Si manipulas líneas directamente desde código Python/XML-RPC/API, SÍ podrías hacer operaciones incorrectas. Por eso los constraints existen.

---

### **P: ¿Cómo pruebo que la independencia funciona?**
**R:** Escenario de prueba manual:
1. Crea Quote → añade Sitio "A" y Sitio "B"
2. Sitio "A" → Servicio "Jardinería" → Rubro "Mano de Obra" → agrega 3 productos
3. Sitio "A" → Servicio "Limpieza" → Rubro "Mano de Obra" → agrega 2 productos
4. Sitio "B" → Servicio "Jardinería" → Rubro "Mano de Obra" → agrega 1 producto

**Verifica:**
- Al cambiar sitio: las pestañas muestran datos diferentes
- Al cambiar servicio (en el mismo sitio): las pestañas muestran datos diferentes
- Los colores de pestañas reflejan el estado correcto para cada combinación

---

## 11. Conclusión

Tu módulo **SÍ garantiza independencia de datos** en todos los niveles:
- Cliente → Cotizaciones
- Cotización → Sitios
- Sitio → Tipos de Servicio
- Tipo de Servicio → Rubros
- Rubro → Líneas

La arquitectura es **sólida** y los ajustes recientes (constraint adicional + esta documentación) fortalecen aún más la separación de datos.

**Recomendación final:** Al entrenar usuarios, enfatiza que:
> "Lo que captures en un sitio/servicio/rubro es completamente independiente de lo que captures en otro. No hay mezclas accidentales."

---

**Autor**: Claude (Anthropic)
**Fecha**: 2025-01-XX
**Versión del módulo**: 18.0.9.8.30