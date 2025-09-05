# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class CCNPickQuoteWizard(models.TransientModel):
    _name = 'ccn.service.quote.pick.wizard'
    _description = 'Pick CCN Service Quote'

    order_id = fields.Many2one('sale.order', required=True, readonly=True)
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True)

    @api.model
    def default_get(self, fields_list):
        vals = super().default_get(fields_list)
        order_id = self.env.context.get('default_order_id') or self.env.context.get('active_id')
        if order_id and (self.env.context.get('active_model') in (None, 'sale.order')):
            vals['order_id'] = order_id
        return vals

    @api.onchange('order_id')
    def _onchange_order_id_set_domain(self):
        """Forzar el dominio del selector para que SOLO muestre cotizaciones del mismo cliente."""
        dom = [('id', '=', 0)]
        partner_id = self.order_id.partner_id.id if self.order_id else False
        if partner_id:
            dom = [('partner_id', '=', partner_id)]
        return {'domain': {'quote_id': dom}}

    def action_apply(self):
        self.ensure_one()
        if not self.order_id or not self.quote_id:
            raise UserError(_('Faltan datos.'))

        # Doble validación de cliente por seguridad
        if self.quote_id.partner_id and self.order_id.partner_id and \
           self.quote_id.partner_id.id != self.order_id.partner_id.id:
            raise UserError(_('Esta cotización pertenece a otro cliente.'))

        self.order_id.ccn_import_from_quote(self.quote_id)
        return {'type': 'ir.actions.act_window_close'}
