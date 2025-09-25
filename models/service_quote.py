# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _

# ---------------------------------------------------------------------------
# QUOTE (encabezado)
# ---------------------------------------------------------------------------
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'
    _sql_constraints = [
        ('ccn_service_quote_partner_name_uniq',
         'unique(partner_id, name)',
         'El nombre de la cotización debe ser único por cliente.'),
    ]

    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))
    currency_id = fields.Many2one(
        'res.currency', string='Moneda', required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # Sitios
    def _default_site_ids(self):
        """Provee un sitio 'General' virtual al crear."""
        return [Command.create({"name": self.env._("General")})]

    site_ids = fields.One2many(
        "ccn.service.quote.site", "quote_id", string="Sitios",
        default=_default_site_ids,
    )

    @api.model
    def default_get(self, fields_list):
        """Deja 'General' listo y seleccionado en current_site_id en el registro nuevo (virtual)."""
        defaults = super().default_get(fields_list)
        defaults.setdefault("site_ids", self._default_site_ids())

        if not self.env.context.get("_ccn_skip_default_site_onchange"):
            quote = self.with_context(_ccn_skip_default_site_onchange=True).new(defaults)
            quote._onchange_site_ids_set_current()
            defaults.update(quote._convert_to_write(quote._cache))
        return defaults

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        """Sincroniza current_site_id con los sitios disponibles (incluye virtuales)."""
        for quote in self:
            if quote.site_ids:
                if quote.current_site_id not in quote.site_ids:
                    quote.current_site_id = quote.site_ids[0]
            else:
                quote.current_site_id = False

    # Modo de presentación
    display_mode = fields.Selection(
        [
            ('by_rubro', 'Acumulado por rubro'),
            ('total_only', 'Acumulado General'),
            ('itemized', 'Resumen'),
        ],
        string='Modo de presentación', default='itemized', required=True,
    )

    # Parámetros
    admin_percent = fields.Float(string='Administración (%)', default=0.0)
    utility_percent = fields.Float(string='Utilidad (%)', default=0.0)
    financial_percent = fields.Float(string='Costo Financiero (%)', default=0.0)
    transporte_rate = fields.Float(string='Tarifa Transporte P/P', default=0.0)
    bienestar_rate = fields.Float(string='Tarifa Bienestar P/P', default=0.0)

    # Filtros de edición
    current_site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio actual',
        # IMPORTANTE: SIN dominio aquí. El dominio flexible vive en la VISTA.
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
        [('servicio', 'Servicio'), ('material', 'Material')],
        string='Tipo actual', default='servicio',
    )

    # Líneas
    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    # Líneas separadas por rubro (para pestañas)
    line_mano_obra_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Mano de Obra', domain=[('rubro_code', '=', 'mano_obra')])
    line_uniforme_ids  = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Uniforme', domain=[('rubro_code', '=', 'uniforme')])
    line_epp_ids       = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas EPP', domain=[('rubro_code', '=', 'epp')])
    line_epp_alturas_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas EPP Alturas', domain=[('rubro_code', '=', 'epp_alturas')])
    line_equipo_especial_limpieza_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Equipo Especial de Limpieza', domain=[('rubro_code', '=', 'equipo_especial_limpieza')])
    line_comunicacion_computo_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Comunicación y Cómputo', domain=[('rubro_code', '=', 'comunicacion_computo')])
    line_herramienta_menor_jardineria_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Herr. Menor Jardinería', domain=[('rubro_code', '=', 'herramienta_menor_jardineria')])
    line_material_limpieza_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Material de Limpieza', domain=[('rubro_code', '=', 'material_limpieza')])
    line_perfil_medico_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Perfil Médico', domain=[('rubro_code', '=', 'perfil_medico')])
    line_maquinaria_limpieza_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Maquinaria Limpieza', domain=[('rubro_code', '=', 'maquinaria_limpieza')])
    line_maquinaria_jardineria_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Maquinaria Jardinería', domain=[('rubro_code', '=', 'maquinaria_jardineria')])
    line_fertilizantes_tierra_lama_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Fertilizantes Tierra Lama', domain=[('rubro_code', '=', 'fertilizantes_tierra_lama')])
    line_consumibles_jardineria_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Consumibles Jardinería', domain=[('rubro_code', '=', 'consumibles_jardineria')])
    line_capacitacion_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Capacitación', domain=[('rubro_code', '=', 'capacitacion')])

    # --- ACK "No aplica" ---
    ack_mano_obra_empty                 = fields.Boolean(string="No aplica Mano de Obra")
    ack_uniforme_empty                  = fields.Boolean(string="No aplica Uniforme")
    ack_epp_empty                       = fields.Boolean(string="No aplica EPP")
    ack_epp_alturas_empty               = fields.Boolean(string="No aplica EPP Alturas")
    ack_equipo_especial_limpieza_empty  = fields.Boolean(string="No aplica Equipo Especial Limpieza")
    ack_comunicacion_computo_empty      = fields.Boolean(string="No aplica Comunicación y Cómputo")
    ack_herramienta_menor_jardineria_empty = fields.Boolean(string="No aplica Herr. Menor Jardinería")
    ack_material_limpieza_empty         = fields.Boolean(string="No aplica Material de Limpieza")
    ack_perfil_medico_empty             = fields.Boolean(string="No aplica Perfil Médico")
    ack_maquinaria_limpieza_empty       = fields.Boolean(string="No aplica Maquinaria de Limpieza")
    ack_maquinaria_jardineria_empty     = fields.Boolean(string="No aplica Maquinaria de Jardinería")
    ack_fertilizantes_tierra_lama_empty = fields.Boolean(string="No aplica Fertilizantes y Tierra Lama")
    ack_consumibles_jardineria_empty    = fields.Boolean(string="No aplica Consumibles de Jardinería")
    ack_capacitacion_empty              = fields.Boolean(string="No aplica Capacitación")

    # --- ESTADOS por rubro (0 rojo, 1 verde, 2 ámbar) ---
    rubro_state_mano_obra                 = fields.Integer(compute="_compute_rubro_states")
    rubro_state_uniforme                  = fields.Integer(compute="_compute_rubro_states")
    rubro_state_epp                       = fields.Integer(compute="_compute_rubro_states")
    rubro_state_epp_alturas               = fields.Integer(compute="_compute_rubro_states")
    rubro_state_equipo_especial_limpieza  = fields.Integer(compute="_compute_rubro_states")
    rubro_state_comunicacion_computo      = fields.Integer(compute="_compute_rubro_states")
    rubro_state_herramienta_menor_jardineria = fields.Integer(compute="_compute_rubro_states")
    rubro_state_material_limpieza         = fields.Integer(compute="_compute_rubro_states")
    rubro_state_perfil_medico             = fields.Integer(compute="_compute_rubro_states")
    rubro_state_maquinaria_limpieza       = fields.Integer(compute="_compute_rubro_states")
    rubro_state_maquinaria_jardineria     = fields.Integer(compute="_compute_rubro_states")
    rubro_state_fertilizantes_tierra_lama = fields.Integer(compute="_compute_rubro_states")
    rubro_state_consumibles_jardineria    = fields.Integer(compute="_compute_rubro_states")
    rubro_state_capacitacion              = fields.Integer(compute="_compute_rubro_states")

    mano_obra_count = fields.Integer(compute='_compute_rubro_counts')
    uniforme_count  = fields.Integer(compute='_compute_rubro_counts')

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'ack_mano_obra_empty', 'ack_uniforme_empty', 'ack_epp_empty', 'ack_epp_alturas_empty',
        'ack_equipo_especial_limpieza_empty', 'ack_comunicacion_computo_empty',
        'ack_herramienta_menor_jardineria_empty', 'ack_material_limpieza_empty',
        'ack_perfil_medico_empty', 'ack_maquinaria_limpieza_empty', 'ack_maquinaria_jardineria_empty',
        'ack_fertilizantes_tierra_lama_empty', 'ack_consumibles_jardineria_empty', 'ack_capacitacion_empty',
    )
    def _compute_rubro_states(self):
        def _state(cnt, ack): return 1 if cnt > 0 else (2 if ack else 0)
        for rec in self:
            lines = rec.line_ids

            def count(code):
                return len(lines.filtered(lambda l: (getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == code))

            rec.rubro_state_mano_obra                 = _state(count('mano_obra'),                rec.ack_mano_obra_empty)
            rec.rubro_state_uniforme                  = _state(count('uniforme'),                 rec.ack_uniforme_empty)
            rec.rubro_state_epp                       = _state(count('epp'),                      rec.ack_epp_empty)
            rec.rubro_state_epp_alturas               = _state(count('epp_alturas'),              rec.ack_epp_alturas_empty)
            rec.rubro_state_equipo_especial_limpieza  = _state(count('equipo_especial_limpieza'), rec.ack_equipo_especial_limpieza_empty)
            rec.rubro_state_comunicacion_computo      = _state(count('comunicacion_computo'),     rec.ack_comunicacion_computo_empty)
            rec.rubro_state_herramienta_menor_jardineria = _state(count('herramienta_menor_jardineria'), rec.ack_herramienta_menor_jardineria_empty)
            rec.rubro_state_material_limpieza         = _state(count('material_limpieza'),        rec.ack_material_limpieza_empty)
            rec.rubro_state_perfil_medico             = _state(count('perfil_medico'),            rec.ack_perfil_medico_empty)
            rec.rubro_state_maquinaria_limpieza       = _state(count('maquinaria_limpieza'),      rec.ack_maquinaria_limpieza_empty)
            rec.rubro_state_maquinaria_jardineria     = _state(count('maquinaria_jardineria'),    rec.ack_maquinaria_jardineria_empty)
            rec.rubro_state_fertilizantes_tierra_lama = _state(count('fertilizantes_tierra_lama'),rec.ack_fertilizantes_tierra_lama_empty)
            rec.rubro_state_consumibles_jardineria    = _state(count('consumibles_jardineria'),   rec.ack_consumibles_jardineria_empty)
            rec.rubro_state_capacitacion              = _state(count('capacitacion'),             rec.ack_capacitacion_empty)

    @api.depends('line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code')
    def _compute_rubro_counts(self):
        for rec in self:
            lines = rec.line_ids
            rec.mano_obra_count = len(lines.filtered(lambda l: (getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == 'mano_obra'))
            rec.uniforme_count  = len(lines.filtered(lambda l: (getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == 'uniforme'))

    # === Botones ACK ===
    def _ack_field_for_code(self, code):
        mapping = {
            'mano_obra': 'ack_mano_obra_empty',
            'uniforme': 'ack_uniforme_empty',
            'epp': 'ack_epp_empty',
            'epp_alturas': 'ack_epp_alturas_empty',
            'equipo_especial_limpieza': 'ack_equipo_especial_limpieza_empty',
            'comunicacion_computo': 'ack_comunicacion_computo_empty',
            'herramienta_menor_jardineria': 'ack_herramienta_menor_jardineria_empty',
            'material_limpieza': 'ack_material_limpieza_empty',
            'perfil_medico': 'ack_perfil_medico_empty',
            'maquinaria_limpieza': 'ack_maquinaria_limpieza_empty',
            'maquinaria_jardineria': 'ack_maquinaria_jardineria_empty',
            'fertilizantes_tierra_lama': 'ack_fertilizantes_tierra_lama_empty',
            'consumibles_jardineria': 'ack_consumibles_jardineria_empty',
            'capacitacion': 'ack_capacitacion_empty',
        }
        return mapping.get(code)

    def _set_ack(self, code, value):
        field_name = self._ack_field_for_code(code)
        if not field_name:
            return
        for rec in self:
            rec[field_name] = bool(value)

    def action_mark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._set_ack(code, True)
        return True

    def action_unmark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._set_ack(code, False)
        return True

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('site_ids'):
                vals['site_ids'] = self._default_site_ids()
        quotes = super().create(vals_list)
        for quote in quotes:
            if not quote.current_site_id and quote.site_ids:
                quote.current_site_id = quote.site_ids[0].id
        return quotes

    @api.onchange('current_service_type')
    def _onchange_current_service_type(self):
        for quote in self:
            quote.current_type = 'material' if quote.current_service_type == 'materiales' else 'servicio'


# ---------------------------------------------------------------------------
# SITE (definido en models/site.py)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# LINE (detalle)
# ---------------------------------------------------------------------------
class ServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'

    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade')
    site_id  = fields.Many2one('ccn.service.quote.site', string='Sitio', ondelete='set null')

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

    rubro_id   = fields.Many2one('ccn.service.rubro', string='Rubro')
    rubro_code = fields.Char(string='Código de Rubro', related='rubro_id.code', store=True, readonly=True)

    product_id = fields.Many2one('product.product', string='Producto/Servicio', required=True)
    quantity   = fields.Float(string='Cantidad', default=1.0)

    currency_id = fields.Many2one('res.currency', string='Moneda', related='quote_id.currency_id', store=True, readonly=True)

    tabulator_percent = fields.Selection([('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%')],
                                         string='Tabulador', default='0', required=True)

    product_base_price = fields.Monetary(string='Precio base', compute='_compute_product_base_price', store=False)
    price_unit_final   = fields.Monetary(string='Precio Unitario', compute='_compute_price_unit_final', store=False)
    taxes_display      = fields.Char(string='Detalle de impuestos', compute='_compute_taxes_display', store=False)
    total_price        = fields.Monetary(string='Subtotal final', compute='_compute_total_price', store=False)

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
