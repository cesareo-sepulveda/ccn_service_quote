# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import ValidationError

class CCNServiceQuoteSite(models.Model):
    _name = "ccn.service.quote.site"
    _description = "Sitio de la Cotización CCN"
    _order = "sequence, id"
    _sql_constraints = [
        ('ccn_quote_site_unique_name_per_quote', 'unique(quote_id, name)',
         'El nombre del sitio debe ser único por cotización.')
    ]

    # Básicos
    name = fields.Char(required=True, index=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    quote_id = fields.Many2one(
        'ccn.service.quote',
        string='Cotización',
        required=False,
        index=True,
        ondelete='cascade'
    )

    # Líneas del sitio
    line_ids = fields.One2many(
        "ccn.service.quote.line",
        "site_id",
        string="Líneas",
    )

    # Moneda (heredada de la quote)
    currency_id = fields.Many2one(
        "res.currency",
        string='Moneda',
        related="quote_id.currency_id",
        store=True,
        readonly=True,
    )

    # Indicadores calculados del sitio
    headcount = fields.Float(
        compute="_compute_indicators", store=True, readonly=True
    )
    subtotal1 = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    admin_amt = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    util_amt = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    subtotal2 = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    transporte_amt = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    bienestar_amt = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    financial_amt = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )
    total_monthly = fields.Monetary(
        compute="_compute_indicators", store=True, readonly=True, currency_field="currency_id"
    )

    # Flags
    is_general = fields.Boolean(
        string="Es General",
        compute="_compute_is_general",
        store=True
    )

    # Cálculos de indicadores
    @api.depends(
        "line_ids.quantity",
        "line_ids.product_id",
        "line_ids.rubro_code",
        "quote_id.admin_percent",
        "quote_id.utility_percent",
        "quote_id.financial_percent",
        "quote_id.transporte_rate",
        "quote_id.bienestar_rate",
    )
    def _compute_indicators(self):
        for site in self:
            lines = site.line_ids
            site.headcount = sum(l.quantity for l in lines if getattr(l, 'rubro_code', False) == "mano_obra")
            base = 0.0
            for l in lines:
                qty = l.quantity or 0.0
                prod_price = l.product_id.list_price if l.product_id else 0.0
                tab = float(getattr(l, 'tabulator_percent', '0') or '0') / 100.0
                pu = prod_price * (1.0 + tab)
                base += qty * pu

            admin_p = site.quote_id.admin_percent or 0.0
            util_p = site.quote_id.utility_percent or 0.0
            fin_p = site.quote_id.financial_percent or 0.0
            trans_p = site.quote_id.transporte_rate or 0.0
            bien_p = site.quote_id.bienestar_rate or 0.0

            admin_amt = base * admin_p / 100.0
            util_amt = (base + admin_amt) * util_p / 100.0
            subtotal2 = base + admin_amt + util_amt

            transporte_amt = subtotal2 * trans_p / 100.0
            bienestar_amt = subtotal2 * bien_p / 100.0
            financial_amt = subtotal2 * fin_p / 100.0

            total = subtotal2 + transporte_amt + bienestar_amt + financial_amt

            site.subtotal1 = base
            site.admin_amt = admin_amt
            site.util_amt = util_amt
            site.subtotal2 = subtotal2
            site.transporte_amt = transporte_amt
            site.bienestar_amt = bienestar_amt
            site.financial_amt = financial_amt
            site.total_monthly = total

    # Computados / Constraints
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

    # Creación / Escritura: normaliza y prioriza 'General'
    @api.model_create_multi
    def create(self, vals_list):
        ctx = self.env.context or {}
        ctx_qid = ctx.get('default_quote_id') or ctx.get('quote_id') or (ctx.get('active_model') == 'ccn.service.quote' and ctx.get('active_id'))
        for vals in vals_list:
            if ctx_qid and not vals.get('quote_id'):
                vals['quote_id'] = ctx_qid
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
                if 'sequence' not in vals:
                    vals['sequence'] = -999
                if 'active' not in vals:
                    vals['active'] = True
        return super().write(vals)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}
        qid = ctx.get('default_quote_id') or ctx.get('quote_id')
        if not qid and ctx.get('active_model') == 'ccn.service.quote':
            qid = ctx.get('active_id')
        if qid and 'quote_id' in self._fields and not res.get('quote_id'):
            res['quote_id'] = qid
        return res

    # UX: 'General' siempre primero en los dropdowns
    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=80):
        args = args or []
        res = super().name_search(name=name, args=args, operator=operator, limit=limit)

        generals = self.with_context(active_test=False).search(args + [('name', '=ilike', 'general')])
        general_ids = generals.ids

        if general_ids and res:
            ids_in_res = [r[0] for r in res]
            generals_in_res = [gid for gid in general_ids if gid in ids_in_res]
            if generals_in_res:
                id2label = dict(res)
                front = [(gid, id2label[gid]) for gid in generals_in_res]
                tail = [(i, id2label[i]) for i in ids_in_res if i not in generals_in_res]
                res = front + tail

        if limit:
            res = res[:limit]
        return res

    # Helper: obtener/crear General para una cotización
    @api.model
    def get_or_create_general(self, quote_id):
        if not quote_id:
            return False
        rec = self.search([
            ('quote_id', '=', quote_id),
            ('name', '=ilike', 'general'),
        ], limit=1)
        if rec:
            if not rec.active or rec.sequence > -999:
                rec.write({'active': True, 'sequence': -999})
            return rec.id
        return self.create({
            'quote_id': quote_id,
            'name': 'General',
            'active': True,
            'sequence': -999,
        }).id
