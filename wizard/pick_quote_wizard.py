# ccn_service_quote/wizard/pick_quote_wizard.py  (o pick_quote.py)
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class PickQuoteWizard(models.TransientModel):
    _name = "ccn.service.quote.pick.wizard"
    _description = "Elegir cotización CCN para una SO"

    order_id = fields.Many2one("sale.order", required=True)
    quote_id = fields.Many2one("ccn.service.quote", string="Cotización")

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        order_id = self.env.context.get("default_order_id")
        if order_id:
            order = self.env["sale.order"].browse(order_id)
            if order.exists():
                res["order_id"] = order.id
        return res

    @api.onchange("order_id")
    def _onchange_order_id(self):
        """Restringe las cotizaciones al mismo cliente de la SO."""
        if self.order_id and self.order_id.partner_id:
            return {
                "domain": {
                    "quote_id": [("partner_id", "=", self.order_id.partner_id.id)]
                }
            }
        return {"domain": {"quote_id": []}}

    def action_apply(self):
        self.ensure_one()
        if not self.order_id:
            raise UserError(_("Primero selecciona una Orden de Venta."))
        if not self.quote_id:
            raise UserError(_("Selecciona una cotización."))
        # Inserta líneas en la SO usando tu método existente
        self.order_id.ccn_import_from_quote(self.quote_id)
        return {"type": "ir.actions.act_window_close"}
