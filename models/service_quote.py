# -*- coding: utf-8 -*-
from odoo import api, fields, models, _

# ------------------------------------------------------------
# Constantes de rubros y mapeo a los One2many ya definidos
# ------------------------------------------------------------
RUBRO_CODES = [
    'mano_obra', 'uniforme', 'epp', 'epp_alturas',
    'equipo_especial_limpieza', 'comunicacion_computo',
    'herramienta_menor_jardineria', 'material_limpieza',
    'perfil_medico', 'maquinaria_limpieza', 'maquinaria_jardineria',
    'fertilizantes_tierra_lama', 'consumibles_jardineria', 'capacitacion',
]

RUBRO_LINES = {
    'mano_obra': 'line_mano_obra_ids',
    'uniforme': 'line_uniforme_ids',
    'epp': 'line_epp_ids',
    'epp_alturas': 'line_epp_alturas_ids',
    'equipo_especial_limpieza': 'line_equipo_especial_limpieza_ids',
    'comunicacion_computo': 'line_comunicacion_computo_ids',
    'herramienta_menor_jardineria': 'line_herramienta_menor_jardineria_ids',
    'material_limpieza': 'line_material_limpieza_ids',
    'perfil_medico': 'line_perfil_medico_ids',
    'maquinaria_limpieza': 'line_maquinaria_limpieza_ids',
    'maquinaria_jardineria': 'line_maquinaria_jardineria_ids',
    'fertilizantes_tierra_lama': 'line_fertilizantes_tierra_lama_ids',
    'consumibles_jardineria': 'line_consumibles_jardineria_ids',
    'capacitacion': 'line_capacitacion_ids',
}

def _state_field(code): return f"rubro_state_{code}"
def _ack_field(code):   return f"ack_{code}_empty"


# ---------------------------------------------------------------------------
# QUOTE (encabezado)
# ---------------------------------------------------------------------------
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'

    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))
    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # Sitios
    site_ids = fields.One2many('ccn.service.quote.site', 'quote_id', string='Sitios')

    # Modo de presentación de la cotización
    display_mode = fields.Selection(
        [
            ('by_rubro', 'Acumulado por rubro'),
            ('total_only', 'Acumulado General'),
            ('itemized', 'Resumen'),
        ],
        string='Modo de presentación',
        default='itemized',
        required=True,
    )

    # Parámetros porcentuales de la cotización
    admin_percent = fields.Float(string='Administración (%)', default=0.0)
    utility_percent = fields.Float(string='Utilidad (%)', default=0.0)
    financial_percent = fields.Float(string='Costo Financiero (%)', default=0.0)
    transporte_rate = fields.Float(string='Tarifa Transporte P/P', default=0.0)
    bienestar_rate = fields.Float(string='Tarifa Bienestar P/P', default=0.0)

    # Campos usados para filtrar la edición de líneas
    current_site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio actual',
        domain="[('quote_id','=', id)]",
    )
    current_service_type = fields.Selection(
        [
            ('jardineria', 'Jardinería'),
            ('limpieza', 'Limpieza'),
            ('mantenimiento', 'Mantenimiento'),
            ('materiales', 'Materiales'),
            ('servicios_especiales', 'Servicios Especiales'),
            ('almacenaje', 'Almacenaje'),
            ('fletes', 'Fletes'),
        ],
        string='Tipo de Servicio/Vista',
    )
    current_type = fields.Selection(
        [
            ('servicio', 'Servicio'),
            ('material', 'Material'),
        ],
        string='Tipo actual',
        default='servicio',
    )

    # Líneas (todas las de la cotización)
    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    # Líneas separadas por rubro para edición en pestañas
    line_mano_obra_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Mano de Obra',
        domain=[('rubro_code', '=', 'mano_obra')],
    )
    line_uniforme_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Uniforme',
        domain=[('rubro_code', '=', 'uniforme')],
    )
    line_epp_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas EPP',
        domain=[('rubro_code', '=', 'epp')],
    )
    line_epp_alturas_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas EPP Alturas',
        domain=[('rubro_code', '=', 'epp_alturas')],
    )
    line_equipo_especial_limpieza_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Equipo Especial de Limpieza',
        domain=[('rubro_code', '=', 'equipo_especial_limpieza')],
    )
    line_comunicacion_computo_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Comunicación y Cómputo',
        domain=[('rubro_code', '=', 'comunicacion_computo')],
    )
    line_herramienta_menor_jardineria_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Herr. Menor Jardinería',
        domain=[('rubro_code', '=', 'herramienta_menor_jardineria')],
    )
    line_material_limpieza_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Material de Limpieza',
        domain=[('rubro_code', '=', 'material_limpieza')],
    )
    line_perfil_medico_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Perfil Médico',
        domain=[('rubro_code', '=', 'perfil_medico')],
    )
    line_maquinaria_limpieza_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Maquinaria Limpieza',
        domain=[('rubro_code', '=', 'maquinaria_limpieza')],
    )
    line_maquinaria_jardineria_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Maquinaria Jardinería',
        domain=[('rubro_code', '=', 'maquinaria_jardineria')],
    )
    line_fertilizantes_tierra_lama_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Fertilizantes Tierra Lama',
        domain=[('rubro_code', '=', 'fertilizantes_tierra_lama')],
    )
    line_consumibles_jardineria_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Consumibles Jardinería',
        domain=[('rubro_code', '=', 'consumibles_jardineria')],
    )
    line_capacitacion_ids = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Capacitacion',
        domain=[('rubro_code', '=', 'capacitacion')],
    )

    # --- Reconocimiento del usuario de que NO cargará datos en ese rubro ---
    # Ya tenías estas dos; las conservo y agrego las demás:
    ack_mano_obra_empty = fields.Boolean(string="No aplica Mano de Obra", default=False)
    ack_uniforme_empty  = fields.Boolean(string="No aplica Uniforme", default=False)
    ack_epp_empty = fields.Boolean(string="No aplica EPP", default=False)
    ack_epp_alturas_empty = fields.Boolean(string="No aplica EPP Alturas", default=False)
    ack_equipo_especial_limpieza_empty = fields.Boolean(string="No aplica Equipo Especial Limpieza", default=False)
    ack_comunicacion_computo_empty = fields.Boolean(string="No aplica Comunicación y Cómputo", default=False)
    ack_herramienta_menor_jardineria_empty = fields.Boolean(string="No aplica Herr. Menor Jardinería", default=False)
    ack_material_limpieza_empty = fields.Boolean(string="No aplica Material Limpieza", default=False)
    ack_perfil_medico_empty = fields.Boolean(string="No aplica Perfil Médico", default=False)
    ack_maquinaria_limpieza_empty = fields.Boolean(string="No aplica Maquinaria Limpieza", default=False)
    ack_maquinaria_jardineria_empty = fields.Boolean(string="No aplica Maquinaria Jardinería", default=False)
    ack_fertilizantes_tierra_lama_empty = fields.Boolean(string="No aplica Fertilizantes/Tierra Lama", default=False)
    ack_consumibles_jardineria_empty = fields.Boolean(string="No aplica Consumibles Jardinería", default=False)
    ack_capacitacion_empty = fields.Boolean(string="No aplica Capacitación", default=False)

    # --- Estados por rubro (selection) que el frontend lee para pintar tabs ---
    rubro_state_mano_obra = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_uniforme  = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_epp       = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_epp_alturas = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_equipo_especial_limpieza = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_comunicacion_computo = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_herramienta_menor_jardineria = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_material_limpieza = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_perfil_medico = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_maquinaria_limpieza = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_maquinaria_jardineria = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_fertilizantes_tierra_lama = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_consumibles_jardineria = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)
    rubro_state_capacitacion = fields.Selection([('red','red'),('yellow','yellow'),('ok','ok')], default='red', compute='_compute_rubro_states', store=True)

    # --- Conteos de líneas por rubro (no imprescindibles; los dejo como tenías) ---
    mano_obra_count = fields.Integer(compute='_compute_rubro_counts')
    uniforme_count  = fields.Integer(compute='_compute_rubro_counts')

    @api.depends('line_ids', 'line_ids.rubro_id')
    def _compute_rubro_counts(self):
        for rec in self:
            lines = rec.line_ids
            rec.mano_obra_count = len(lines.filtered(lambda l: getattr(l.rubro_id, 'code', False) == 'mano_obra'))
            rec.uniforme_count  = len(lines.filtered(lambda l: getattr(l.rubro_id, 'code', False) == 'uniforme'))

    # --- Compute del estado por rubro (usa 'No Aplica' + conteo filtrado como en las pestañas) ---
    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.site_id', 'line_ids.type', 'line_ids.service_type',
        'current_site_id', 'current_type', 'current_service_type',
        'ack_mano_obra_empty', 'ack_uniforme_empty', 'ack_epp_empty', 'ack_epp_alturas_empty',
        'ack_equipo_especial_limpieza_empty', 'ack_comunicacion_computo_empty',
        'ack_herramienta_menor_jardineria_empty', 'ack_material_limpieza_empty',
        'ack_perfil_medico_empty', 'ack_maquinaria_limpieza_empty', 'ack_maquinaria_jardineria_empty',
        'ack_fertilizantes_tierra_lama_empty', 'ack_consumibles_jardineria_empty', 'ack_capacitacion_empty',
    )
    def _compute_rubro_states(self):
        for rec in self:
            for code in RUBRO_CODES:
                # 1) Si hay “No Aplica” → amarillo
                if getattr(rec, _ack_field(code), False):
                    val = 'yellow'
                else:
                    # 2) Conteo de líneas de ese rubro, alineado a los filtros de la vista
                    lines_field = RUBRO_LINES.get(code)
                    lines = getattr(rec, lines_field)
                    if rec.current_site_id:
                        lines = lines.filtered(lambda l: l.site_id == rec.current_site_id)
                    if rec.current_type:
                        lines = lines.filtered(lambda l: (l.type or '') == rec.current_type)
                    if rec.current_service_type:
                        lines = lines.filtered(lambda l: (l.service_type or '') == rec.current_service_type)
                    val = 'ok' if len(lines) > 0 else 'red'
                setattr(rec, _state_field(code), val)

    # --- Acciones usadas por los botones “No Aplica” / “Quitar No Aplica” en las pestañas ---
    def action_mark_rubro_empty(self):
        self.ensure_one()
        code = self.env.context.get('rubro_code')
        if code:
            if hasattr(self, _ack_field(code)):
                self.write({ _ack_field(code): True })
            else:
                self.write({ _state_field(code): 'yellow' })

    def action_unmark_rubro_empty(self):
        self.ensure_one()
        code = self.env.context.get('rubro_code')
        if code:
            if hasattr(self, _ack_field(code)):
                self.write({ _ack_field(code): False })
            else:
                # El compute recalculará a 'ok' si hay líneas, 'red' si no
                self.write({ _state_field(code): 'red' })

    # --- RPC para que el frontend pueda leer el mapa de estados si aún no está en el DOM ---
    def get_rubro_states(self, ids):
        rec = self.browse(ids[:1])
        res = {}
        for code in RUBRO_CODES:
            res[code] = getattr(rec, _state_field(code)) or ''
        # Alias para el tab XML page_herr_menor_jardineria (frontend lo normaliza igual)
        res['herr_menor_jardineria'] = res.get('herramienta_menor_jardineria', '')
        return res

    @api.model_create_multi
    def create(self, vals_list):
        """Asegura que cada cotización tenga al menos un sitio y lo establezca como actual."""
        for vals in vals_list:
            if not vals.get('site_ids'):
                vals['site_ids'] = [(0, 0, {'name': _('Sitio Default')})]
        quotes = super().create(vals_list)
        for quote in quotes:
            if not quote.current_site_id and quote.site_ids:
                quote.current_site_id = quote.site_ids[0].id
        return quotes

    @api.onchange('current_service_type')
    def _onchange_current_service_type(self):
        """Ajusta automáticamente el tipo servicio/material según el tipo de servicio o vista."""
        for quote in self:
            quote.current_type = 'material' if quote.current_service_type == 'materiales' else 'servicio'


# ---------------------------------------------------------------------------
# SITE
# ---------------------------------------------------------------------------
class ServiceQuoteSite(models.Model):
    _name = 'ccn.service.quote.site'
    _description = 'CCN Service Quote Site'

    name = fields.Char(string='Nombre del sitio', required=True)
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade')
    category_id = fields.Many2one('product.category', string='Categoría')

    # Líneas de este sitio (útil para depuraciones y vistas por sitio)
    line_ids = fields.One2many('ccn.service.quote.line', 'site_id', string='Líneas del sitio')


# ---------------------------------------------------------------------------
# LINE (detalle)
# ---------------------------------------------------------------------------
class ServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'

    # Enlaces
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade')
    site_id = fields.Many2one('ccn.service.quote.site', string='Sitio', ondelete='set null')
    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], string='Tipo de Servicio/Vista')
    type = fields.Selection([
        ('servicio', 'Servicio'),
        ('material', 'Material'),
    ], string='Tipo', default='servicio', required=True)

    # Rubro (asumimos que el modelo existe en tu módulo)
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro')

    # Producto / Servicio
    product_id = fields.Many2one('product.product', string='Producto/Servicio', required=True)

    # Cantidad
    quantity = fields.Float(string='Cantidad', default=1.0)

    # Moneda: ligada a la de la cotización
    currency_id = fields.Many2one('res.currency', string='Moneda',
                                  related='quote_id.currency_id', store=True, readonly=True)

    # Tabulador (0, 3, 5, 10%)
    tabulator_percent = fields.Selection([
        ('0', '0%'),
        ('3', '3%'),
        ('5', '5%'),
        ('10', '10%'),
    ], string='Tabulador', default='0', required=True)

    # Precio base (NO related para evitar inconsistencias de tipo entre versiones)
    product_base_price = fields.Monetary(string='Precio base', compute='_compute_product_base_price', store=False)

    # Precio unitario final (base * (1 + tabulador))
    price_unit_final = fields.Monetary(string='Precio Unitario', compute='_compute_price_unit_final', store=False)

    # Impuestos (texto, tomado del producto si existe account)
    taxes_display = fields.Char(string='Detalle de impuestos', compute='_compute_taxes_display', store=False)

    # Subtotal (cantidad * precio unitario final)
    total_price = fields.Monetary(string='Subtotal final', compute='_compute_total_price', store=False)

    # -------------------- Computes --------------------
    @api.depends('product_id')
    def _compute_product_base_price(self):
        for line in self:
            base = line.product_id.list_price if line.product_id else 0.0
            if line.quote_id.currency_id:
                base = line.quote_id.currency_id.round(base)
            line.product_base_price = base

    @api.depends('product_base_price', 'tabulator_percent')
    def _compute_price_unit_final(self):
        for line in self:
            base = line.product_base_price or 0.0
            tab = float(line.tabulator_percent or '0') / 100.0
            val = base * (1.0 + tab)
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.price_unit_final = val

    @api.depends('product_id')
    def _compute_taxes_display(self):
        tax_model = self.env.get('account.tax')
        for line in self:
            txt = ''
            taxes = getattr(line.product_id, 'taxes_id', False)
            if tax_model and taxes:
                txt = ', '.join(taxes.mapped('name'))
            line.taxes_display = txt

    @api.depends('quantity', 'price_unit_final')
    def _compute_total_price(self):
        for line in self:
            qty = line.quantity or 0.0
            val = (line.price_unit_final or 0.0) * qty
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.total_price = val

    # -------------------- Defaults vía contexto --------------------
    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}
        if 'default_quote_id' in ctx and 'quote_id' in self._fields:
            res.setdefault('quote_id', ctx.get('default_quote_id'))
        if 'default_site_id' in ctx and 'site_id' in self._fields:
            res.setdefault('site_id', ctx.get('default_site_id'))
        if 'default_type' in ctx and 'type' in self._fields:
            res.setdefault('type', ctx.get('default_type'))
        if 'default_service_type' in ctx and 'service_type' in self._fields:
            res.setdefault('service_type', ctx.get('default_service_type'))
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id
        return res
