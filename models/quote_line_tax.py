# ccn_service_quote/models/quote_line_tax.py
from odoo import api, models

class CcnServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'  # o _name si es la clase base

    @api.onchange('product_id')
    def _onchange_product_set_taxes(self):
        for line in self:
            if not line.product_id:
                line.tax_ids = [(6, 0, [])]
                continue

            # Toma impuestos del producto
            taxes = line.product_id.taxes_id

            # Filtra por compañía usando la compañía de la cabecera
            company = line.quote_id.company_id or self.env.company
            if company:
                taxes = taxes.filtered(lambda t: (not t.company_id) or (t.company_id == company))

            # (Opcional) mapear con fpos si tu quote tiene partner/fiscal_position
            # fpos = line.quote_id.fiscal_position_id
            # if fpos:
            #     taxes = fpos.map_tax(taxes, partner=line.quote_id.partner_id)

            line.tax_ids = [(6, 0, taxes.ids)]
