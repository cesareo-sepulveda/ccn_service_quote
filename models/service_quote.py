# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError

# -------------------------
# Catálogo de rubros (códigos)
# -------------------------
RUBRO_CODES = [
    ("mano_obra","Mano de Obra"),
    ("uniforme","Uniforme"),
    ("epp","EPP"),
    ("epp_alturas","EPP Alturas"),
    ("equipo_especial_limpieza","Equipo Especial de Limpieza"),
    ("comunicacion_computo","Comunicación y Cómputo"),
    ("herramienta_menor_jardineria","Herramienta Menor de Jardinería"),
    ("material_limpieza","Material de Limpieza"),
    ("perfil_medico","Perfil Médico"),
    ("maquinaria_limpieza","Maquinaria de Limpieza"),
    ("maquinaria_jardineria","Maquinaria de Jardinería"),
    ("fertilizantes_tierra_lama","Fertilizantes y Tierra Lama"),
    ("consumibles_jardineria","Consumibles de Jardinería"),
    ("capacitacion","Capacitación"),
]

# =====================================================================
# QUOTE (encabezado)
# =====================================================================
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'

    _sql_constraints = [
        ('ccn_service_quote_partner_name_uniq', 'unique(partner_id, name)',
         'El nombre de la cotización debe ser único por cliente.')
    ]

    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, index=True)
    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))

    currency_id = fields.Many2one(
        'res.currency', string='Moneda', required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # Sitios
    def _default_site_ids(self):
        return [Command.create({'name': self.env._('General')})]

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
        [('servicio', 'Servicio'), ('material', 'Material')],
        string='Tipo actual',
        default='servicio',
    )

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

    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    # Estados por rubro (filtrados por sitio/servicio/tipo actual)
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

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type', 'line_ids.type',
        'current_site_id', 'current_service_type', 'current_type'
    )
    def _compute_rubro_states(self):
        def state_for(rec, code):
            lines = rec.line_ids.filtered(lambda l:
                (not rec.current_site_id or l.site_id.id == rec.current_site_id.id) and
                (not rec.current_service_type or l.service_type == rec.current_service_type) and
                (not rec.current_type or l.type == rec.current_type) and
                ((getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == code)
            )
            cnt = len(lines)
            ack = self.env['ccn.service.quote.ack'].search_count([
                ('quote_id', '=', rec.id),
                ('site_id', '=', rec.current_site_id.id if rec.current_site_id else False),
                ('service_type', '=', rec.current_service_type or False),
                ('rubro_code', '=', code),
                ('is_empty', '=', True),
            ]) > 0
            return 1 if cnt > 0 else (2 if ack else 0)

        for rec in self:
            rec.rubro_state_mano_obra                 = state_for(rec, 'mano_obra')
            rec.rubro_state_uniforme                  = state_for(rec, 'uniforme')
            rec.rubro_state_epp                       = state_for(rec, 'epp')
            rec.rubro_state_epp_alturas               = state_for(rec, 'epp_alturas')
            rec.rubro_state_equipo_especial_limpieza  = state_for(rec, 'equipo_especial_limpieza')
            rec.rubro_state_comunicacion_computo      = state_for(rec, 'comunicacion_computo')
            rec.rubro_state_herramienta_menor_jardineria = state_for(rec, 'herramienta_menor_jardineria')
            rec.rubro_state_material_limpieza         = state_for(rec, 'material_limpieza')
            rec.rubro_state_perfil_medico             = state_for(rec, 'perfil_medico')
            rec.rubro_state_maquinaria_limpieza       = state_for(rec, 'maquinaria_limpieza')
            rec.rubro_state_maquinaria_jardineria     = state_for(rec, 'maquinaria_jardineria')
            rec.rubro_state_fertilizantes_tierra_lama = state_for(rec, 'fertilizantes_tierra_lama')
            rec.rubro_state_consumibles_jardineria    = state_for(rec, 'consumibles_jardineria')
            rec.rubro_state_capacitacion              = state_for(rec, 'capacitacion')

    # ACK granular
    def _ensure_ack(self, rubro_code, value):
        for rec in self:
            if not (rec.current_site_id and rec.current_service_type and rubro_code):
                continue
            ack = self.env['ccn.service.quote.ack'].search([
                ('quote_id', '=', rec.id),
                ('site_id', '=', rec.current_site_id.id),
                ('service_type', '=', rec.current_service_type),
                ('rubro_code', '=', rubro_code),
            ], limit=1)
            if ack:
                ack.write({'is_empty': bool(value)})
            else:
                self.env['ccn.service.quote.ack'].create({
                    'quote_id': rec.id,
                    'site_id': rec.current_site_id.id,
                    'service_type': rec.current_service_type,
                    'rubro_code': rubro_code,
                    'is_empty': True,
                })

    def action_mark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._ensure_ack(code, True)
        return True

    def action_unmark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._ensure_ack(code, False)
        return True

    # Botón para garantizar/crear Sitio "General"
    def action_ensure_general(self):
        Site = self.env['ccn.service.quote.site'].with_context(active_test=False)
        for quote in self:
            general = Site.search([
                ('quote_id', '=', quote.id),
                ('name', '=ilike', 'general'),
            ], limit=1)
            if general:
                general.write({'active': True, 'sequence': -999})
            else:
                general = Site.create({
                    'quote_id': quote.id,
                    'name': 'General',
                    'active': True,
                    'sequence': -999,
                })
            quote.current_site_id = general.id
        return True

    # Defaults para que "General" aparezca de inmediato
    @api.model
    def default_get(self, fields_list):
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

    # Usado por data/migrate_fix_general.xml
    @api.model
    def _fix_general_sites(self, limit=100000):
        Site = self.env['ccn.service.quote.site'].with_context(active_test=False)
        quotes = self.search([], limit=limit)
        for q in quotes:
            general = Site.search([
                ('quote_id', '=', q.id),
                ('name', '=ilike', 'general'),
            ], limit=1)
            if general:
                general.write({'active': True, 'sequence': -999})
            else:
                general = Site.create({
                    'quote_id': q.id,
                    'name': 'General',
                    'active': True,
                    'sequence': -999,
                })
            if not q.current_site_id:
                q.write({'current_site_id': general.id})
        return True


# =====================================================================
# LÍNEA (detalle)
# =====================================================================
class CCNServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'
    _order = 'id desc'

    # Relaciones principales
    quote_id = fields.Many2one(
        'ccn.service.quote',
        string='Cotización',
        required=True,
        ondelete='cascade',
        index=True,
    )
    site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio',
        ondelete='set null',
        index=True,
    )

    # Contexto de vista
    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], string='Tipo de Servicio', index=True)

    type = fields.Selection([
        ('servicio', 'Servicio'),
        ('material', 'Material'),
    ], string='Tipo', default='servicio', required=True, index=True)

    # Rubro
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro', index=True)

    # ⚠️ Char compute (NO related) para evitar choque con Selection de rubro_id.code
    rubro_code = fields.Char(
        string='Código de Rubro',
        compute='_compute_rubro_code',
        store=False,
        readonly=True,
        index=True,
    )

    # Producto (filtrado por rubro)
    product_id = fields.Many2one(
        'product.product',
        string='Producto/Servicio',
        required=True,
        index=True,
        # Evitamos 'in' con lista vacía; usamos OR de igualdades
        domain="['&', ('product_tmpl_id.ccn_exclude_from_quote','=',False), "
               "'|', ('product_tmpl_id.ccn_rubro_ids.code','=', context.get('ctx_rubro_code')), "
                     "('product_tmpl_id.ccn_rubro_ids.code','=', rubro_code)]",
    )

    # Cantidad
    quantity = fields.Float(string='Cantidad', default=1.0)

    # Moneda
    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        related='quote_id.currency_id',
        store=True,
        readonly=True,
    )

    # Tabulador
    tabulator_percent = fields.Selection(
        [('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%')],
        string='Tabulador',
        default='0',
        required=True,
    )

    # Precios / impuestos / totales (simplificados)
    product_base_price = fields.Monetary(
        string='Precio base',
        compute='_compute_product_base_price',
        store=True,
    )
    price_unit_final = fields.Monetary(
        string='Precio Unitario',
        compute='_compute_price_unit_final',
        store=True,
    )
    taxes_display = fields.Char(
        string='Detalle de impuestos',
        compute='_compute_taxes_display',
        store=False,
    )
    amount_tax = fields.Monetary(
        string='IVA',
        compute='_compute_amount_tax',
        store=False,
        currency_field='currency_id',
    )
    total_price = fields.Monetary(
        string='Subtotal final',
        compute='_compute_total_price',
        store=False,
    )

    # ===== Cómputos =====
    @api.depends('rubro_id', 'rubro_id.code')
    def _compute_rubro_code(self):
        for rec in self:
            rec.rubro_code = rec.rubro_id.code or False

    @api.depends('product_id')
    def _compute_product_base_price(self):
        for line in self:
            val = line.product_id.list_price if line.product_id else 0.0
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.product_base_price = val

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

    @api.depends('price_unit_final', 'quantity', 'product_id')
    def _compute_amount_tax(self):
        for line in self:
            total = (line.price_unit_final or 0.0) * (line.quantity or 0.0)
            rate = 0.0
            taxes = getattr(line.product_id, 'taxes_id', False)
            if taxes:
                rate = sum(t.amount for t in taxes if getattr(t, 'amount_type', 'percent') == 'percent') / 100.0
            amt = total * rate
            if line.quote_id.currency_id:
                amt = line.quote_id.currency_id.round(amt)
            line.amount_tax = amt

    @api.depends('quantity', 'price_unit_final')
    def _compute_total_price(self):
        for line in self:
            val = (line.price_unit_final or 0.0) * (line.quantity or 0.0)
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.total_price = val

    # ===== Defaults desde contexto =====
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

        # Fijar rubro por pestaña (ctx_rubro_code)
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id

        return res

    # Onchange para reforzar el dominio de producto por rubro
    @api.onchange('rubro_id')
    def _onchange_rubro_id(self):
        code = self.rubro_id.code if self.rubro_id else False
        return {
            'domain': {
                'product_id': [
                    ('product_tmpl_id.ccn_exclude_from_quote','=', False),
                    '|',
                        ('product_tmpl_id.ccn_rubro_ids.code','=', code),
                        ('product_tmpl_id.ccn_rubro_ids.code','=', False),  # evita dominio inválido si no hay code
                ]
            }
        }
