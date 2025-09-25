# -*- coding: utf-8 -*-
from odoo import api, fields, models

class PickQuoteWizard(models.TransientModel):
    _name = "ccn.service.quote.pick.wizard"
    _description = "Seleccionar Cotización CCN"

    order_id = fields.Many2one("sale.order", string="Pedido", readonly=True)
    quote_id = fields.Many2one("ccn.service.quote", string="Cotización", required=True)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}
        if ctx.get("active_model") == "sale.order" and ctx.get("active_id"):
            res["order_id"] = ctx["active_id"]
        return res

    def action_confirm(self):
        """Aquí puedes implementar el “uso” de la cotización elegida.
        Por ahora, sólo cierra el wizard de forma segura.
        """
        return {"type": "ir.actions.act_window_close"}
