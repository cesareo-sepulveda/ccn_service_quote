# -*- coding: utf-8 -*-
from odoo import models, fields

class ServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Muestra en la línea los impuestos del producto seleccionado
    product_taxes_ids = fields.Many2many(
        comodel_name='account.tax',
        related='product_id.taxes_id',
        string='Impuestos',
        readonly=True,
    )
