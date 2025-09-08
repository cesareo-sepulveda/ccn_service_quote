from odoo import models, fields

class ServiceQuoteLineRelated(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Precio unitario desde el TEMPLATE para mantener tipo Monetary correcto
    product_base_price = fields.Monetary(
        string='Precio unitario',
        related='product_id.product_tmpl_id.list_price',
        currency_field='currency_id',
        readonly=True,
    )

    # Impuestos del producto (para mostrar en la lista)
    product_taxes_id = fields.Many2many(
        comodel_name='account.tax',
        related='product_id.taxes_id',
        string='Impuestos (producto)',
        readonly=True,
    )
