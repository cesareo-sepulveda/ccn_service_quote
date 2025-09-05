# -*- coding: utf-8 -*-
from odoo import models, fields

class CCNPickServiceQuoteWizard(models.TransientModel):
    _name = "ccn.service.quote.pick.wizard"
    _description = "Elegir CCN Service Quote"

    order_id = fields.Many2one("sale.order", required=True)
    quote_id = fields.Many2one("ccn.service.quote", required=True)

    def action_apply(self):
        self.ensure_one()
        self.order_id.ccn_import_from_quote(self.quote_id)
        return {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "res_id": self.order_id.id,
            "view_mode": "form",
            "target": "current",
        }
