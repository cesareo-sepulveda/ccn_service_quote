# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import ValidationError

class CCNServiceQuoteSite(models.Model):
    _name = "ccn.service.quote.site"
    _description = "Sitio de la Cotización CCN"
    _order = "sequence, id"

    # Básicos
    name = fields.Char(required=True, index=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    quote_id = fields.Many2one(
        'ccn.service.quote', string='Cotización',
        required=True, index=True, ondelete='cascade'
    )

    # Líneas del sitio
    line_ids = fields.One2many("ccn.service.quote.line", "site_id", string="Líneas")

    # Moneda (heredada de la quote)
    currency_id = fields.Many2one("res.currency", string='Moneda',
                                  related="quote_id.currency_id", store=True, readonly=True)

    # Indicadores
    headcount = fields.Float(compute="_compute_indicators", store=True, readonly=True)
    subtotal1 = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    admin_amt = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    util_amt = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    subtotal2 = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    transporte_amt = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    bienestar_amt = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    financial_amt = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")
    total_monthly = fields.Monetary(compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id")

    # Flag
    is_general = fields.Boolean(string="Es General", compute="_compute_is_general", store=True)

    @api.depends(
        "line_ids.quantity", "line_ids.price_unit_final", "line_ids.total_price", "line_ids.rubro_code",
        "quote_id.admin_percent", "quote_id.utility_percent", "quote_id.financial_percent",
        "quote_id.transporte_rate", "quote_id.bienestar_rate",
    )
    def _compute_indicators(self):
        for site in self:
            lines = site.line_ids
            site.headcount = sum(l.quantity for l in lines if l.rubro_code == "mano_obra")
            base = sum(l.total_price or 0.0 for l in lines)

            admin_p = site.quote_id.admin_percent or 0.0
            util_p  = site.quote_id.utility_percent or 0.0
            fin_p   = site.quote_id.financial_percent or 0.0
            trans_p = site.quote_id.transporte_rate or 0.0
            bien_p  = site.quote_id.bienestar_rate or 0.0

            admin_amt = base * admin_p / 100.0
            util_amt  = (base + admin_amt) * util_p / 100.0
            subtotal2 = base + admin_amt + util_amt

            transporte_amt = subtotal2 * trans_p / 100.0
            bienestar_amt  = subtotal2 * bien_p / 100.0
            financial_amt  = subtotal2 * fin_p / 100.0
            total          = subtotal2 + transporte_amt + bienestar_amt + financial_amt

            site.subtotal1 = base
            site.admin_amt = admin_amt
            site.util_amt = util_amt
            site.subtotal2 = subtotal2
            site.transporte_amt = transporte_amt
            site.bienestar_amt = bienestar_amt
            site.financial_amt = financial_amt
            site.total_monthly = total

    @api.depends('name')
    def _compute_is_general(self):
        for rec in self:
            rec.is_general = ((rec.name or '').strip().lower() == 'general')

    @api.constrains('name', 'quote_id')
    def _check_single_general_per_quote(self):
        for rec in self:
            if not rec.quote_id or not rec.name:
                continue
            if (rec.name or '').strip().lower() == 'general':
                dup = self.search([
                    ('id', '!=', rec.id),
                    ('quote_id', '=', rec.quote_id.id),
                    ('name', '=ilike', 'general'),
                    ('active', 'in', [True, False]),
                ], limit=1)
                if dup:
                    raise ValidationError("Solo puede existir un sitio llamado 'General' por cotización.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            nm = (vals.get('name') or '').strip()
            if nm and nm.lower() == 'general':
                vals['name'] = 'General'
                vals.setdefault('active', True)
                if 'sequence' not in vals or vals.get('sequence') is None:
                    vals['sequence'] = -999
        return super().create(vals_list)

    def write(self, vals):
        if 'name' in vals and vals.get('name'):
            nm = (vals.get('name') or '').strip()
            if nm.lower() == 'general':
                vals['name'] = 'General'
                vals.setdefault('sequence', -999)
                vals.setdefault('active', True)
        return super().write(vals)

    # --- UX: 'General' arriba en dropdowns ---
    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=80):
        args = args or []
        res = super().name_search(name=name, args=args, operator=operator, limit=limit)

        generals = self.with_context(active_test=False).search(args + [('name', '=ilike', 'general')])
        general_ids = generals.ids

        if general_ids and res:
            id2label = dict(res)
            ids_in_res = [r[0] for r in res]
            generals_in_res = [gid for gid in general_ids if gid in ids_in_res]
            if generals_in_res:
                front = [(gid, id2label[gid]) for gid in generals_in_res]
                tail = [(i, id2label[i]) for i in ids_in_res if i not in generals_in_res]
                res = front + tail
        return res[:limit] if limit else res

    @api.model
    def name_create(self, name):
        vals = {'name': (name or '').strip() or 'General'}
        if vals['name'].lower() == 'general':
            vals.update({'name': 'General', 'active': True, 'sequence': -999})
        rec = self.create(vals)
        return rec.name_get()[0]

    @api.model
    def get_or_create_general(self, quote_id):
        if not quote_id:
            return False
        rec = self.search([('quote_id', '=', quote_id), ('name', '=ilike', 'general')], limit=1)
        if rec:
            if not rec.active or rec.sequence > -999:
                rec.write({'active': True, 'sequence': -999})
            return rec.id
        return self.create({'quote_id': quote_id, 'name': 'General', 'active': True, 'sequence': -999}).id
