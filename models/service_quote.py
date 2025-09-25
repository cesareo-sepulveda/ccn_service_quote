# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError

# ---------------------------------------------------------------------------
# ACK POR SITIO / TIPO DE SERVICIO / RUBRO
# ---------------------------------------------------------------------------
class ServiceQuoteAck(models.Model):
    _name = 'ccn.service.quote.ack'
    _description = 'ACK de Rubro por Sitio/Tipo'
    _rec_name = 'rubro_code'

    quote_id = fields.Many2one('ccn.service.quote', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one('ccn.service.quote.site', required=True, ondelete='cascade', index=True)
    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], required=True, index=True)
    rubro_code = fields.Char(required=True, index=True)
    is_ack = fields.Boolean(default=False)

    _sql_constraints = [
        ('uniq_scope', 'unique(quote_id,site_id,service_type,rubro_code)',
         'Ya existe un ACK para este sitio/tipo/rubro.'),
    ]


# ---------------------------------------------------------------------------
# QUOTE (encabezado)
# ---------------------------------------------------------------------------
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'
    _order = 'id desc'
    _sql_constraints = [
        (
            'ccn_service_quote_partner_name_uniq',
            'unique(partner_id, name)',
            'El nombre de la cotización debe ser único por cliente.',
        )
    ]

    # Básicos
    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))
    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, index=True)

    # Moneda (no se muestra en la vista pero se usa en cálculos)
    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # Sitios
    def _default_site_ids(self):
        """Crea un registro virtual 'General' al abrir la forma."""
        return [Command.create({"name": self.env._("General")})]

    site_ids = fields.One2many(
        "ccn.service.quote.site",
        "quote_id",
        string="Sitios",
        default=_default_site_ids,
    )

    current_site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio',
        domain="[('quote_id','=', id)]",
        ondelete='restrict',
    )

    # Ámbitos de filtrado
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

    current_type = fields.Selection(
        [
            ('servicio', 'Servicio'),
            ('material', 'Material'),
        ],
        string='Tipo actual',
        default='servicio',
    )

    # Modo presentación / parámetros
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

    admin_percent = fields.Float(string='Administración (%)', default=0.0)
    utility_percent = fields.Float(string='Utilidad (%)', default=0.0)
    financial_percent = fields.Float(string='Costo Financiero (%)', default=0.0)
    transporte_rate = fields.Float(string='Tarifa Transporte P/P', default=0.0)
    bienestar_rate = fields.Float(string='Tarifa Bienestar P/P', default=0.0)

    # Líneas (todas, separadas por dominios en la vista)
    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    # ----------------------------
    # Defaults / Onchanges / Create
    # ----------------------------
    @api.model
    def default_get(self, fields_list):
        """Asegura que 'General' esté disponible y seleccionado al abrir."""
        defaults = super().default_get(fields_list)
        defaults.setdefault("site_ids", self._default_site_ids())

        if not self.env.context.get("_ccn_skip_default_site_onchange"):
            quote = self.with_context(_ccn_skip_default_site_onchange=True).new(defaults)
            quote._onchange_site_ids_set_current()
            defaults.update(quote._convert_to_write(quote._cache))
        return defaults

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        for quote in self:
            if quote.site_ids:
                if quote.current_site_id not in quote.site_ids:
                    quote.current_site_id = quote.site_ids[0]
            else:
                quote.current_site_id = False

    @api.onchange('current_service_type')
    def _onchange_current_service_type(self):
        for quote in self:
            quote.current_type = 'material' if quote.current_service_type == 'materiales' else 'servicio'

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

    # ----------------------------
    # Botón: asegurar 'General'
    # ----------------------------
    def action_ensure_general(self):
        Site = self.env['ccn.service.quote.site'].sudo()
        for quote in self:
            gen_id = Site.get_or_create_general(quote.id)
            if gen_id and quote.current_site_id.id != gen_id:
                quote.current_site_id = gen_id
        return True

    # ----------------------------
    # ACK helpers y acciones
    # ----------------------------
    def _ack_scope_vals(self, rubro_code):
        self.ensure_one()
        return {
            'quote_id': self.id,
            'site_id': self.current_site_id.id if self.current_site_id else False,
            'service_type': self.current_service_type or False,
            'rubro_code': rubro_code,
        }

    def _set_ack(self, rubro_code, value):
        for quote in self:
            if not quote.current_site_id or not quote.current_service_type:
                # No hay contexto para ACK
                continue
            vals_scope = quote._ack_scope_vals(rubro_code)
            Ack = self.env['ccn.service.quote.ack'].sudo()
            ack = Ack.search([
                ('quote_id', '=', vals_scope['quote_id']),
                ('site_id', '=', vals_scope['site_id']),
                ('service_type', '=', vals_scope['service_type']),
                ('rubro_code', '=', vals_scope['rubro_code']),
            ], limit=1)
            if ack:
                ack.is_ack = bool(value)
            elif value:
                vals_scope['is_ack'] = True
                Ack.create(vals_scope)

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


# ---------------------------------------------------------------------------
# LINE (detalle)
# ---------------------------------------------------------------------------
class ServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'
    _order = 'id'

    # Enlaces
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one('ccn.service.quote.site', string='Sitio', ondelete='set null', index=True)

    # Ámbitos
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
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro', index=True)
    rubro_code = fields.Char(string='Código de Rubro', related='rubro_id.code', store=True, readonly=True)

    # Producto / Servicio
    product_id = fields.Many2one('product.product', string='Producto/Servicio', required=True, index=True)

    # Cantidad y moneda
    quantity = fields.Float(string='Cantidad', default=1.0)
    currency_id = fields.Many2one('res.currency', string='Moneda', related='quote_id.currency_id', store=True, readonly=True)

    # Tabulador
    tabulator_percent = fields.Selection([
        ('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%'),
    ], string='Tabulador', default='0', required=True)

    # Precios / totales
    product_base_price = fields.Monetary(string='Precio base', compute='_compute_product_base_price', store=False)
    price_unit_final   = fields.Monetary(string='Precio Unitario', compute='_compute_price_unit_final', store=False)
    taxes_display      = fields.Char(string='Detalle de impuestos', compute='_compute_taxes_display', store=False)
    total_price        = fields.Monetary(string='Subtotal final', compute='_compute_total_price', store=False)

    # ----------- Cálculos -----------
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

    # ----------- Defaults -----------
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

        # Fijar rubro por pestaña (ctx_rubro_code) si no lo trajeron ya
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id
        return res
