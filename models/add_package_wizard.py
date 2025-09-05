# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError

class CcnServiceAddPackageWizard(models.TransientModel):
    _name = 'ccn.service.add.package.wizard'
    _description = 'Asistente: Agregar paquete a cotización'

    package_id = fields.Many2one(
        'ccn.service.package',
        string="Paquete",
        required=True
    )

    @api.model
    def _get_active_order(self):
        if self.env.context.get('active_model') != 'sale.order':
            raise UserError("Este asistente debe abrirse desde una cotización.")
        order = self.env['sale.order'].browse(self.env.context.get('active_id'))
        if not order:
            raise UserError("No se encontró la cotización activa.")
        return order

    def action_apply(self):
        """Inserta las líneas del paquete como líneas de sale.order."""
        self.ensure_one()
        order = self._get_active_order()

        if not self.package_id.line_ids:
            return {'type': 'ir.actions.act_window_close'}

        # Preparamos comandos para order_line. Usamos list price como base.
        # (Si quieres respetar listas de precios, podemos ajustarlo luego.)
        commands = []
        for pline in self.package_id.line_ids:
            vals = {
                'order_id': order.id,
                'product_id': pline.product_id.id,
                'product_uom_qty': pline.quantity,
                'price_unit': pline.product_id.lst_price,  # básico; se puede cambiar a pricelist
            }
            commands.append((0, 0, vals))

        if commands:
            order.write({'order_line': commands})

        return {'type': 'ir.actions.act_window_close'}
