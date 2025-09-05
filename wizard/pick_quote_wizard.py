# ccn_service_quote/wizard/pick_quote_wizard.py
# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class CCNPickQuoteWizard(models.TransientModel):
    _name = 'ccn.service.quote.pick.wizard'
    _description = 'Pick CCN Service Quote'

    order_id = fields.Many2one(
        'sale.order',
        string='Orden de Venta',
        required=True,
        ondelete='cascade',
    )
    quote_id = fields.Many2one(
        'ccn.service.quote',
        string='Cotización CCN',
        required=True,
        help='Se filtra automáticamente por el mismo cliente de la Orden de Venta.',
    )

    @api.model
    def default_get(self, fields_list):
        """Prellenar order_id desde el contexto: default_order_id o active_id."""
        res = super().default_get(fields_list)
        order_id = (
            self.env.context.get('default_order_id')
            or (self.env.context.get('active_model') == 'sale.order'
                and self.env.context.get('active_id'))
        )
        if order_id:
            res['order_id'] = order_id
        return res

    @api.onchange('order_id')
    def _onchange_order_id(self):
        """Al cambiar la SO, limitar las quotes al mismo cliente."""
        dom = []
        if self.order_id and self.order_id.partner_id:
            dom = [('partner_id', '=', self.order_id.partner_id.id)]
        # Puedes añadir más filtros si quieres (estado, compañía, etc.)
        return {'domain': {'quote_id': dom}}

    def action_apply(self):
        """Insertar líneas de la quote en la SO y cerrar el wizard."""
        self.ensure_one()
        if not self.order_id or not self.quote_id:
            raise UserError(_("Selecciona la Orden de Venta y la Cotización."))

        # Validación fuerte y creación de líneas vive en sale.order.ccn_import_from_quote
        self.order_id.ccn_import_from_quote(self.quote_id)

        # Cerrar el diálogo
        return {'type': 'ir.actions.act_window_close'}
