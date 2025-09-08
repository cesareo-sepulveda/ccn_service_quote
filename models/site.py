# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuoteSite(models.Model):
    _name = "ccn.service.quote.site"
    _description = "Sitio de la Cotización CCN"
    _order = "sequence, id"

    # Básicos
    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización',
        required=True, index=True, ondelete='cascade')

    # Líneas del sitio
    line_ids = fields.One2many(
        "ccn.service.quote.line",
        "site_id",
        string="Líneas",
    )

    # Moneda (heredada de la quote)
    currency_id = fields.Many2one(
        "res.currency", string='Moneda',
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

    @api.depends(
        "line_ids.quantity",
        "line_ids.price_unit_final",
        "line_ids.total_price",
        "line_ids.rubro_code",
        "quote_id.admin_percent",
        "quote_id.utility_percent",
        "quote_id.financial_percent",
        "quote_id.transporte_rate",
        "quote_id.bienestar_rate",
    )
    def _compute_indicators(self):
        """
        - headcount: suma de quantities en el rubro 'mano_obra'
        - subtotal1: suma de total_price de las líneas del sitio
        - admin/util/financiero/transporte/bienestar: porcentajes encadenados
        - total_monthly: subtotal2 + extras
        """
        for site in self:
            lines = site.line_ids

            # Headcount: utiliza el código fijo del rubro
            headcount = sum(l.quantity for l in lines if l.rubro_code == "mano_obra")

            # Base del sitio: usamos el subtotal de cada línea
            base = sum(l.total_price or 0.0 for l in lines)

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

            site.headcount = headcount
            site.subtotal1 = base
            site.admin_amt = admin_amt
            site.util_amt = util_amt
            site.subtotal2 = subtotal2
            site.transporte_amt = transporte_amt
            site.bienestar_amt = bienestar_amt
            site.financial_amt = financial_amt
            site.total_monthly = total
