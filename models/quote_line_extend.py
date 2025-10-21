# -*- coding: utf-8 -*-
from odoo import models, fields

class ServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Muestra en la línea los impuestos del producto seleccionado
    product_taxes_ids = fields.Many2many(
        comodel_name='account.tax',
        related='product_id.taxes_id',
        string='Impuestos del producto',
        readonly=True,
    )

    def action_open_catalog_wizard(self):
        """Abre el catálogo desde una línea de cotización"""
        # Si se llama desde el control de la lista, self puede estar vacío o tener múltiples registros
        # En ese caso, obtener el quote_id del contexto
        quote_id = self.env.context.get('default_quote_id')

        if not quote_id and self:
            # Si hay al menos un registro, usar el primero
            if len(self) > 0:
                quote_id = self[0].quote_id.id

        if quote_id:
            quote = self.env['ccn.service.quote'].browse(quote_id)
            # Llamar al método del quote con el contexto adecuado
            return quote.with_context(
                rubro_code=self.env.context.get('rubro_code') or self.env.context.get('ctx_rubro_code')
            ).action_open_catalog_wizard()

        return False
