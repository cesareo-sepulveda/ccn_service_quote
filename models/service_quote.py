# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError


# ---------------------------------------------------------------------------
# QUOTE (encabezado)
# ---------------------------------------------------------------------------
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'
    _sql_constraints = [
        (
            'ccn_service_quote_partner_name_uniq',
            'unique(partner_id, name)',
            'El nombre de la cotización debe ser único por cliente.',
        )
    ]

    # Identificación
    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))
    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, index=True)

    # Moneda (necesaria para campos Monetary; no es obligatorio mostrarla en la vista)
    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # -------------------------
    # Sitios
    # -------------------------
    def _default_site_ids(self):
        """Proveer un sitio 'General' virtual desde el arranque."""
        return [Command.create({"name": self.env._("General")})]

    site_ids = fields.One2many(
        "ccn.service.quote.site",
        "quote_id",
        string="Sitios",
        default=_default_site_ids,
    )

    current_site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio actual',
        domain="[('quote_id','=', id)]",
    )

    @api.model
    def default_get(self, fields_list):
        """Asegura sitio 'General' virtual y posiciona current_site_id."""
        defaults = super().default_get(fields_list)
        defaults.setdefault("site_ids", self._default_site_ids())

        if not self.env.context.get("_ccn_skip_default_site_onchange"):
            quote = self.with_context(_ccn_skip_default_site_onchange=True).new(defaults)
            quote._onchange_site_ids_set_current()
            defaults.update(quote._convert_to_write(quote._cache))

        return defaults

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        """Sincroniza current_site_id con los sitios disponibles (primer elemento)."""
        for quote in self:
            if quote.site_ids:
                if quote.current_site_id not in quote.site_ids:
                    quote.current_site_id = quote.site_ids[0]
            else:
                quote.current_site_id = False

    def action_ensure_general(self):
        """Botón 'Sitio General': garantiza que exista 'General' y lo selecciona."""
        Site = self.env['ccn.service.quote.site'].sudo()
        for quote in self:
            gen_id = Site.get_or_create_general(quote.id)
            quote.current_site_id = gen_id
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

    # -------------------------
    # Ámbito visible de edición
    # -------------------------
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
        string='Tipo de servicio',
    )

    # Campo interno para separar Servicio/Material (no mostrar en la vista si no lo necesitas)
    current_type = fields.Selection(
        [
            ('servicio', 'Servicio'),
            ('material', 'Material'),
        ],
        string='Tipo actual',
        default='servicio',
    )

    @api.onchange('current_service_type')
    def _onchange_current_service_type(self):
        for quote in self:
            quote.current_type = 'material' if quote.current_service_type == 'materiales' else 'servicio'

    # -------------------------
    # Parámetros (afectan indicadores del sitio)
    # -------------------------
    admin_percent = fields.Float(string='Administración (%)', default=0.0)
    utility_percent = fields.Float(string='Utilidad (%)', default=0.0)
    financial_percent = fields.Float(string='Costo Financiero (%)', default=0.0)
    transporte_rate = fields.Float(string='Tarifa Transporte P/P', default=0.0)
    bienestar_rate = fields.Float(string='Tarifa Bienestar P/P', default=0.0)

    # -------------------------
    # Líneas (todas) y por rubro (para pestañas)
    # -------------------------
    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    line_mano_obra_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Mano de Obra', domain=[('rubro_code', '=', 'mano_obra')])
    line_uniforme_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas Uniforme', domain=[('rubro_code', '=', 'uniforme')])
    line_epp_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas EPP', domain=[('rubro_code', '=', 'epp')])
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

    # -------------------------
    # ACK por ámbito (site + service_type + rubro)
    # -------------------------
    ack_ids = fields.One2many('ccn.service.quote.ack', 'quote_id', string='ACKs')

    # Dominio base de líneas según el ámbito visible actual
    def _scope_domain(self):
        """Dominio de líneas restringido al contexto visible actual."""
        self.ensure_one()
        domain = [('quote_id', '=', self.id)]
        if self.current_site_id:
            domain.append(('site_id', '=', self.current_site_id.id))
        if self.current_service_type:
            domain.append(('service_type', '=', self.current_service_type))
        if self.current_type:
            domain.append(('type', '=', self.current_type))
        return domain

    # Helpers ACK (ámbito actual)
    def _ack_domain_for_code(self, code):
        self.ensure_one()
        if not (self.current_site_id and self.current_service_type and code):
            # Sin ámbito completo no hay ACK aplicable
            return [('id', '=', 0)]
        return [
            ('quote_id', '=', self.id),
            ('site_id', '=', self.current_site_id.id),
            ('service_type', '=', self.current_service_type),
            ('rubro_code', '=', code),
            ('is_empty', '=', True),
        ]

    def _has_ack(self, code):
        return bool(self.env['ccn.service.quote.ack'].search_count(self._ack_domain_for_code(code)))

    def _set_ack(self, code, value):
        Ack = self.env['ccn.service.quote.ack']
        for rec in self:
            dom = rec._ack_domain_for_code(code)
            if value:
                if dom[0][0] == 'id' and dom[0][2] == 0:
                    # ámbito incompleto -> no hacemos nada
                    continue
                if not Ack.search(dom, limit=1):
                    Ack.create({
                        'quote_id': rec.id,
                        'site_id': rec.current_site_id.id,
                        'service_type': rec.current_service_type,
                        'rubro_code': code,
                        'is_empty': True,
                    })
            else:
                acks = Ack.search(dom)
                acks.unlink()

    # Botones desde la vista con context={'rubro_code': '...'}
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

    # -------------------------
    # Estados / Conteos por rubro
    # -------------------------
    # Estados por rubro (0=rojo, 1=verde, 2=ámbar)
    rubro_state_mano_obra                 = fields.Integer(compute="_compute_rubro_states", string="Estado Mano de Obra")
    rubro_state_uniforme                  = fields.Integer(compute="_compute_rubro_states", string="Estado Uniforme")
    rubro_state_epp                       = fields.Integer(compute="_compute_rubro_states", string="Estado EPP")
    rubro_state_epp_alturas               = fields.Integer(compute="_compute_rubro_states", string="Estado EPP Alturas")
    rubro_state_equipo_especial_limpieza  = fields.Integer(compute="_compute_rubro_states", string="Estado Equipo Especial Limpieza")
    rubro_state_comunicacion_computo      = fields.Integer(compute="_compute_rubro_states", string="Estado Comunicación y Cómputo")
    rubro_state_herramienta_menor_jardineria = fields.Integer(compute="_compute_rubro_states", string="Estado Herr. Menor Jardinería")
    rubro_state_material_limpieza         = fields.Integer(compute="_compute_rubro_states", string="Estado Material de Limpieza")
    rubro_state_perfil_medico             = fields.Integer(compute="_compute_rubro_states", string="Estado Perfil Médico")
    rubro_state_maquinaria_limpieza       = fields.Integer(compute="_compute_rubro_states", string="Estado Maquinaria Limpieza")
    rubro_state_maquinaria_jardineria     = fields.Integer(compute="_compute_rubro_states", string="Estado Maquinaria Jardinería")
    rubro_state_fertilizantes_tierra_lama = fields.Integer(compute="_compute_rubro_states", string="Estado Fertilizantes y Tierra Lama")
    rubro_state_consumibles_jardineria    = fields.Integer(compute="_compute_rubro_states", string="Estado Consumibles Jardinería")
    rubro_state_capacitacion              = fields.Integer(compute="_compute_rubro_states", string="Estado Capacitación")

    # Conteos de ejemplo (opcionales)
    mano_obra_count = fields.Integer(compute='_compute_rubro_counts')
    uniforme_count  = fields.Integer(compute='_compute_rubro_counts')

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type', 'line_ids.type',
        'current_site_id', 'current_service_type', 'current_type',
        'ack_ids.is_empty', 'ack_ids.rubro_code', 'ack_ids.site_id', 'ack_ids.service_type',
    )
    def _compute_rubro_states(self):
        """0 = rojo (no hay líneas y sin ACK)
           1 = verde (hay líneas en el ámbito actual)
           2 = ámbar (no hay líneas en el ámbito actual pero ACK marcado)"""
        def _state(cnt, ack):
            return 1 if cnt > 0 else (2 if ack else 0)

        Line = self.env['ccn.service.quote.line']
        for rec in self:
            base = rec._scope_domain()

            def count(code):
                dom = base + ['|', ('rubro_code', '=', code), ('rubro_id.code', '=', code)]
                return Line.search_count(dom)

            # ACK por ámbito
            acc = lambda code: rec._has_ack(code)

            rec.rubro_state_mano_obra                 = _state(count('mano_obra'),                 acc('mano_obra'))
            rec.rubro_state_uniforme                  = _state(count('uniforme'),                  acc('uniforme'))
            rec.rubro_state_epp                       = _state(count('epp'),                       acc('epp'))
            rec.rubro_state_epp_alturas               = _state(count('epp_alturas'),               acc('epp_alturas'))
            rec.rubro_state_equipo_especial_limpieza  = _state(count('equipo_especial_limpieza'),  acc('equipo_especial_limpieza'))
            rec.rubro_state_comunicacion_computo      = _state(count('comunicacion_computo'),      acc('comunicacion_computo'))
            rec.rubro_state_herramienta_menor_jardineria = _state(count('herramienta_menor_jardineria'), acc('herramienta_menor_jardineria'))
            rec.rubro_state_material_limpieza         = _state(count('material_limpieza'),         acc('material_limpieza'))
            rec.rubro_state_perfil_medico             = _state(count('perfil_medico'),             acc('perfil_medico'))
            rec.rubro_state_maquinaria_limpieza       = _state(count('maquinaria_limpieza'),       acc('maquinaria_limpieza'))
            rec.rubro_state_maquinaria_jardineria     = _state(count('maquinaria_jardineria'),     acc('maquinaria_jardineria'))
            rec.rubro_state_fertilizantes_tierra_lama = _state(count('fertilizantes_tierra_lama'), acc('fertilizantes_tierra_lama'))
            rec.rubro_state_consumibles_jardineria    = _state(count('consumibles_jardineria'),    acc('consumibles_jardineria'))
            rec.rubro_state_capacitacion              = _state(count('capacitacion'),              acc('capacitacion'))

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type', 'line_ids.type',
        'current_site_id', 'current_service_type', 'current_type'
    )
    def _compute_rubro_counts(self):
        Line = self.env['ccn.service.quote.line']
        for rec in self:
            base = rec._scope_domain()

            def count(code):
                dom = base + ['|', ('rubro_code', '=', code), ('rubro_id.code', '=', code)]
                return Line.search_count(dom)

            rec.mano_obra_count = count('mano_obra')
            rec.uniforme_count  = count('uniforme')


# ---------------------------------------------------------------------------
# LINE (detalle)
# ---------------------------------------------------------------------------
class ServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'

    # Relaciones
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio',
        ondelete='set null',
        domain="[('quote_id', '=', quote_id)]",
        index=True,
    )

    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], string='Tipo de servicio')

    type = fields.Selection([
        ('servicio', 'Servicio'),
        ('material', 'Material'),
    ], string='Tipo', default='servicio', required=True)

    # Rubro
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro')
    rubro_code = fields.Char(string='Código de Rubro', related='rubro_id.code', store=True, readonly=True)

    # Producto / Servicio
    product_id = fields.Many2one('product.product', string='Producto/Servicio', required=True)

    # Cantidad
    quantity = fields.Float(string='Cantidad', default=1.0)

    # Moneda
    currency_id = fields.Many2one('res.currency', string='Moneda', related='quote_id.currency_id', store=True, readonly=True)

    # Tabulador
    tabulator_percent = fields.Selection([
        ('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%'),
    ], string='Tabulador', default='0', required=True)

    # Precios / impuestos / totales
    product_base_price = fields.Monetary(string='Precio base', compute='_compute_product_base_price', store=False)
    price_unit_final   = fields.Monetary(string='Precio Unitario', compute='_compute_price_unit_final', store=False)
    taxes_display      = fields.Char(string='Detalle de impuestos', compute='_compute_taxes_display', store=False)
    total_price        = fields.Monetary(string='Subtotal final', compute='_compute_total_price', store=False)

    # -------------------------
    # Cómputos
    # -------------------------
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

    # -------------------------
    # Defaults por contexto
    # -------------------------
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

    # -------------------------
    # Consistencia sitio ⇄ cotización
    # -------------------------
    @api.constrains('site_id', 'quote_id')
    def _check_site_matches_quote(self):
        for rec in self:
            if rec.site_id and rec.quote_id and rec.site_id.quote_id != rec.quote_id:
                raise ValidationError("El sitio seleccionado pertenece a otra cotización.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            site_id = vals.get('site_id')
            qid = vals.get('quote_id')
            if site_id and not qid:
                site = self.env['ccn.service.quote.site'].browse(site_id)
                vals['quote_id'] = site.quote_id.id
            elif site_id and qid:
                site = self.env['ccn.service.quote.site'].browse(site_id)
                if site and site.quote_id.id != qid:
                    raise ValidationError("El sitio seleccionado pertenece a otra cotización.")
        return super().create(vals_list)

    def write(self, vals):
        res = super().write(vals)
        for rec in self:
            if rec.site_id and rec.quote_id and rec.site_id.quote_id != rec.quote_id:
                raise ValidationError("El sitio seleccionado pertenece a otra cotización.")
        return res
