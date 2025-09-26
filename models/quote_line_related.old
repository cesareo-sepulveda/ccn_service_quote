from odoo import models, fields

class ServiceQuoteLineRelated(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Impuestos del producto (para mostrar en la lista)
    product_taxes_id = fields.Many2many(
        comodel_name='account.tax',
        related='product_id.taxes_id',
        string='Impuestos (producto)',
        readonly=True,
    )
