# -*- coding: utf-8 -*-
from collections import defaultdict

from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError

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

RUBRO_STATE_FIELDS = {
    "mano_obra": "rubro_state_mano_obra",
    "uniforme": "rubro_state_uniforme",
    "epp": "rubro_state_epp",
    "epp_alturas": "rubro_state_epp_alturas",
    "equipo_especial_limpieza": "rubro_state_equipo_especial_limpieza",
    "comunicacion_computo": "rubro_state_comunicacion_computo",
    "herramienta_menor_jardineria": "rubro_state_herramienta_menor_jardineria",
    "material_limpieza": "rubro_state_material_limpieza",
    "perfil_medico": "rubro_state_perfil_medico",
    "maquinaria_limpieza": "rubro_state_maquinaria_limpieza",
    "maquinaria_jardineria": "rubro_state_maquinaria_jardineria",
    "fertilizantes_tierra_lama": "rubro_state_fertilizantes_tierra_lama",
    "consumibles_jardineria": "rubro_state_consumibles_jardineria",
    "capacitacion": "rubro_state_capacitacion",
}

# =========================================================
#    QUOTE
# =========================================================
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

    # Relación completa de líneas (todas)
    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas (todas)')

    ack_ids = fields.One2many(
        'ccn.service.quote.ack',
        'quote_id',
        string='Reconocimientos por Rubro',
    )

    # ===== One2many *por rubro* (campos distintos para cada pestaña)
    # Notas:
    #  - Son “proxies” al mismo comodel/inversa, pero con distinto nombre de campo.
    #  - El filtrado fino se hace en las vistas XML usando domains por sitio/servicio/rubro.
    line_ids_mano_obra                = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Mano de Obra',
        domain="[('rubro_code','=','mano_obra'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_uniforme                 = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Uniforme',
        domain="[('rubro_code','=','uniforme'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_epp                      = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas EPP',
        domain="[('rubro_code','=','epp'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_epp_alturas              = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas EPP Alturas',
        domain="[('rubro_code','=','epp_alturas'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_equipo_especial_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Equipo Especial Limpieza',
        domain="[('rubro_code','=','equipo_especial_limpieza'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_comunicacion_computo     = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Comunicación/Computo',
        domain="[('rubro_code','=','comunicacion_computo'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_herramienta_menor_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Herr. Menor Jardinería',
        domain="[('rubro_code','=','herramienta_menor_jardineria'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_material_limpieza        = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Material Limpieza',
        domain="[('rubro_code','=','material_limpieza'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_perfil_medico            = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Perfil Médico',
        domain="[('rubro_code','=','perfil_medico'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_maquinaria_limpieza      = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Maquinaria Limpieza',
        domain="[('rubro_code','=','maquinaria_limpieza'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_maquinaria_jardineria    = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Maquinaria Jardinería',
        domain="[('rubro_code','=','maquinaria_jardineria'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_fertilizantes_tierra_lama= fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Fertilizantes/Tierra Lama',
        domain="[('rubro_code','=','fertilizantes_tierra_lama'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_consumibles_jardineria   = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Consumibles Jardinería',
        domain="[('rubro_code','=','consumibles_jardineria'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )
    line_ids_capacitacion             = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        string='Líneas Capacitación',
        domain="[('rubro_code','=','capacitacion'), ('site_id','=', current_site_id), ('service_type','=', current_service_type)]"
    )

    # ===== Estados por rubro (1 lleno, 2 ack, 0 vacío)
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
        'line_ids.site_id', 'line_ids.service_type',
        'ack_ids', 'ack_ids.rubro_code', 'ack_ids.site_id', 'ack_ids.service_type', 'ack_ids.ack',
        'current_site_id', 'current_service_type'
    )
    def _compute_rubro_states(self):
        for rec in self:
            states = rec._get_rubro_state_map()
            for code, field_name in RUBRO_STATE_FIELDS.items():
                setattr(rec, field_name, states.get(code, 0))

    @api.onchange(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type',
        'current_site_id', 'current_service_type'
    )
    def _onchange_recompute_rubro_states(self):
        self._compute_rubro_states()

    def _get_rubro_state_map(self):
        self.ensure_one()
        state_map = {code: 0 for code in RUBRO_STATE_FIELDS}

        site = self.current_site_id
        service = self.current_service_type
        current_site_id = site.id if site else False
        current_service_type = service or False

        if not (current_site_id and current_service_type):
            return state_map

        line_counts = defaultdict(int)
        is_general_site = bool(getattr(site, 'is_general', False))
        for line in self.line_ids:
            if line.site_id:
                if line.site_id.id != current_site_id:
                    continue
            else:
                # Solo consideramos líneas sin sitio cuando el sitio actual es General.
                if not is_general_site:
                    continue
            if line.service_type != current_service_type:
                continue
            code = line.rubro_code or line.rubro_id.code
            if code:
                line_counts[code] += 1

        ack_map = {}
        if self.id:
            matching_acks = self.ack_ids.filtered(
                lambda a: a.ack
                and a.service_type == current_service_type
                and (
                    (a.site_id and a.site_id.id == current_site_id)
                    or (not a.site_id and is_general_site)
                )
            )
            ack_map = {ack.rubro_code: True for ack in matching_acks}

        for code in state_map:
            if line_counts.get(code):
                state_map[code] = 1
            elif ack_map.get(code):
                state_map[code] = 2

        return state_map

    # ACK granular (No aplica)
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
                ack.write({'ack': bool(value)})
            elif bool(value):
                self.env['ccn.service.quote.ack'].create({
                    'quote_id': rec.id,
                    'site_id': rec.current_site_id.id,
                    'service_type': rec.current_service_type,
                    'rubro_code': rubro_code,
                    'ack': True,
                })
        self.invalidate_cache(fnames=['ack_ids'])
        self._compute_rubro_states()

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

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        defaults.setdefault("site_ids", self._default_site_ids())
        return defaults

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        for quote in self:
            if quote.site_ids:
                if quote.current_site_id not in quote.site_ids:
                    quote.current_site_id = quote.site_ids[0]
            else:
                quote.current_site_id = False

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

    # Usado por data/migrate_fix_general.xml (si lo sigues cargando)
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


# =========================================================
#    QUOTE LINE
# =========================================================
class CCNServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'
    _order = 'id desc'

    quote_id = fields.Many2one(
        'ccn.service.quote', string='Cotización',
        required=True, ondelete='cascade', index=True,
    )
    site_id = fields.Many2one(
        'ccn.service.quote.site', string='Sitio',
        ondelete='set null', index=True,
    )

    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], string='Tipo de Servicio', index=True)

    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro', index=True)

    # Char relacionado y ALMACENADO para filtrar en SQL
    rubro_code = fields.Char(
        string='Código de Rubro',
        compute='_compute_rubro_code',
        store=True,
        readonly=True,
        index=True,
    )

    product_id = fields.Many2one(
        'product.product',
        string='Producto/Servicio',
        required=True,
        index=True,
        domain="['&', ('product_tmpl_id.ccn_exclude_from_quote','=',False), "
               "'|', ('product_tmpl_id.ccn_rubro_ids.code','=', context.get('ctx_rubro_code')), "
                     "('product_tmpl_id.ccn_rubro_ids.code','=', rubro_code)]",
    )

    quantity = fields.Float(string='Cantidad', default=1.0)

    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        related='quote_id.currency_id',
        store=True,
        readonly=True,
    )

    tabulator_percent = fields.Selection(
        [('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%')],
        string='Tabulador',
        default='0',
        required=True,
    )

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

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}
        if 'default_quote_id' in ctx and 'quote_id' in self._fields:
            res.setdefault('quote_id', ctx.get('default_quote_id'))
        if 'default_site_id' in ctx and 'site_id' in self._fields:
            res.setdefault('site_id', ctx.get('default_site_id'))
        if 'default_service_type' in ctx and 'service_type' in self._fields:
            res.setdefault('service_type', ctx.get('default_service_type'))
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id
        return res

    @api.onchange('rubro_id')
    def _onchange_rubro_id(self):
        code = self.rubro_id.code if self.rubro_id else False
        return {
            'domain': {
                'product_id': [
                    ('product_tmpl_id.ccn_exclude_from_quote','=', False),
                    '|',
                        ('product_tmpl_id.ccn_rubro_ids.code','=', code),
                        ('product_tmpl_id.ccn_rubro_ids.code','=', False),
                ]
            }
        }
