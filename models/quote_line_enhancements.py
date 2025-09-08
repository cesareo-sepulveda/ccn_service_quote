# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuoteLine(models.Model):
    _inherit = "ccn.service.quote.line"

    # Impuestos seleccionables
    tax_ids = fields.Many2many(
        "account.tax",
        "ccn_quote_line_tax_rel",
        "line_id",
        "tax_id",
        string="Impuestos aplicables",
        help="Impuestos aplicables a esta línea",
    )

    # Subtotales mostrados en UI
    price_subtotal = fields.Monetary(
        string="Subtotal base",
        currency_field="currency_id",
        compute="_compute_display_amounts",
        store=False,
    )
    amount_tax = fields.Monetary(
        string="Monto de impuestos",
        currency_field="currency_id",
        compute="_compute_display_amounts",
        store=False,
    )

    @api.depends("quantity", "price_unit_final", "tax_ids")
    def _compute_display_amounts(self):
        for line in self:
            qty = line.quantity or 0.0
            pu = line.price_unit_final or 0.0
            subtotal = qty * pu
            percent = 0.0
            for tax in line.tax_ids:
                if getattr(tax, "amount_type", "percent") == "percent":
                    percent += (tax.amount or 0.0)
            line.price_subtotal = subtotal
            line.amount_tax = subtotal * (percent / 100.0)

    @api.model
    def default_get(self, fields_list):
        """Si viene ctx_rubro_code en el contexto, fija rubro_id/rubro_code."""
        res = super().default_get(fields_list)
        ctx_code = self.env.context.get("ctx_rubro_code")
        if ctx_code:
            Rubro = self.env["ccn.service.rubro"]
            rubro = Rubro.search([("code", "=", ctx_code)], limit=1)
            if rubro:
                if "rubro_id" in self._fields and not res.get("rubro_id"):
                    res["rubro_id"] = rubro.id
                if "rubro_code" in self._fields:
                    # Si rubro_code es related y readonly, no pasa nada si no se escribe.
                    res["rubro_code"] = rubro.code
        return res
