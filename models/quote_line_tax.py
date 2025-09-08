from odoo import api, fields, models

class ServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Impuestos seleccionables en la línea (de venta)
    tax_ids = fields.Many2many(
        'account.tax', 'ccn_quote_line_tax_rel', 'line_id', 'tax_id',
        string='Impuestos',
        domain="[('type_tax_use','=','sale'), ('company_id','=', company_id)]",
        help="Impuestos aplicables; por defecto se copian del producto."
    )

    @api.onchange('product_id', 'company_id')
    def _onchange_product_set_taxes(self):
        """Copiar impuestos del producto al elegirlo."""
        for line in self:
            if not line.product_id:
                line.tax_ids = [(5, 0, 0)]  # limpiar
                continue
            taxes = line.product_id.taxes_id.filtered(
                lambda t: (not t.company_id) or (t.company_id == line.company_id)
            )
            line.tax_ids = taxes
