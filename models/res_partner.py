# -*- coding: utf-8 -*-
"""Extensiones del modelo de clientes para cotizaciones de servicio."""

from odoo import fields, models
from odoo.tools import safe_eval



class ResPartner(models.Model):
    """Relaciona a cada cliente con sus cotizaciones de servicio."""

    _inherit = "res.partner"

    service_quote_ids = fields.One2many(
        "ccn.service.quote",
        "partner_id",
        string="Cotizaciones de servicio",
    )

    service_quote_count = fields.Integer(
        string="Número de cotizaciones de servicio",
        compute="_compute_service_quote_count",
    )

    def _compute_service_quote_count(self):
        """Count the number of CCN quotes linked to each partner."""
        if not self.ids:
            return
        counts = {
            data["partner_id"][0]: data["partner_id_count"]
            for data in self.env["ccn.service.quote"].read_group(
                [("partner_id", "in", self.ids)],
                fields=["partner_id"],
                groupby=["partner_id"],
            )
        }
        for partner in self:
            partner.service_quote_count = counts.get(partner.id, 0)

    def action_view_service_quotes(self):
        """Open the CCN service quotes filtered by this partner."""
        self.ensure_one()
        action = self.env.ref("ccn_service_quote.ccn_action_quotes").read()[0]
        raw_context = action.get("context") or "{}"
        context = dict(self.env.context)
        context.update(safe_eval(raw_context))
        context.update(
            {
                "default_partner_id": self.id,
                "force_partner_id": self.id,
                "ccn_partner_id": self.id,
            }
        )
        action["context"] = context
        action["domain"] = [("partner_id", "=", self.id)]
        return action

