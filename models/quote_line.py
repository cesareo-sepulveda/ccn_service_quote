# -*- coding: utf-8 -*-
from odoo import api, fields, models

class ServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Muestra los impuestos del producto como texto (no requiere instalar 'account')
    taxes_display = fields.Char(string='Impuestos', compute='_compute_taxes_display', store=False)

    @api.depends('product_id')
    def _compute_taxes_display(self):
        tax_model = self.env.get('account.tax')
        for line in self:
            txt = ''
            # Si existe 'account.tax' y el producto tiene impuestos configurados, se muestran por nombre
            if line.product_id and tax_model and hasattr(line.product_id, 'taxes_id') and line.product_id.taxes_id:
                txt = ', '.join(line.product_id.taxes_id.mapped('name'))
            line.taxes_display = txt

    @api.model
    def default_get(self, fields_list):
        """Permite que, al crear una línea desde una pestaña de rubro,
        se asigne automáticamente el rubro correcto usando ctx_rubro_code.
        """
        res = super().default_get(fields_list)
        code = self.env.context.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and 'rubro_id' in fields_list and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id
        return res
