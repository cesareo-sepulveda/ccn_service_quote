# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class CCNServiceQuotePickWizard(models.TransientModel):
    _name = "ccn.service.quote.pick.wizard"
    _description = "Elegir cotización CCN para SO"

    order_id = fields.Many2one(
        "sale.order",
        string="Orden de venta",
        required=True,
        readonly=True,
    )
    # IMPORTANTE: no required=True para evitar NOT NULL en BD
    quote_id = fields.Many2one(
        "ccn.service.quote",
        string="Cotización CCN",
        required=False,
        help="Cotización de servicio a importar a la Orden de Venta.",
    )

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}
        if ctx.get("active_model") == "sale.order" and ctx.get("active_id"):
            res["order_id"] = ctx["active_id"]
        return res

    def action_apply(self):
        self.ensure_one()
        if not self.order_id:
            raise UserError(_("Este asistente debe abrirse desde una Orden de Venta."))
        if not self.quote_id:
            raise UserError(_("Selecciona una cotización antes de continuar."))

        # Validación extra por si alguien evade el dominio
        so_partner = self.order_id.partner_id
        q_partner = self.quote_id.partner_id
        if not so_partner:
            raise UserError(_("La Orden de Venta no tiene cliente."))
        if not q_partner:
            raise UserError(_("La cotización seleccionada no tiene cliente."))
        if so_partner.id != q_partner.id:
            raise UserError(_(
                "La cotización es del cliente '%s' y la SO es del cliente '%s'."
            ) % (q_partner.display_name, so_partner.display_name))

        # Llama a tu importador
        self.order_id.ccn_import_from_quote(self.quote_id)
        return {"type": "ir.actions.act_window_close"}
