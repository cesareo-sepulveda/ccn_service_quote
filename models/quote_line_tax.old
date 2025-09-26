from odoo import api, models

class CcnServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'  # o _name si es la clase base

    @api.onchange('product_id', 'product_tmpl_id')
    def _onchange_product_set_taxes(self):
        for line in self:
            # Obtén el producto, ya sea product.product o product.template
            product = getattr(line, 'product_id', False) or getattr(line, 'product_tmpl_id', False)
            if not product:
                line.tax_ids = [(6, 0, [])]
                continue

            # Compañía robusta: usa la de la quote si existe; si no, la compañía activa del entorno
            company = getattr(line.quote_id, 'company_id', False) or self.env.company

            # Toma impuestos del producto y filtra por compañía (o sin compañía)
            taxes = product.taxes_id
            if company:
                taxes = taxes.filtered(lambda t: (not t.company_id) or (t.company_id.id == company.id))

            # (Opcional) mapear con posición fiscal si la tienes en la quote:
            # fpos = getattr(line.quote_id, 'fiscal_position_id', False)
            # partner = getattr(line.quote_id, 'partner_id', False)
            # if fpos:
            #     taxes = fpos.map_tax(taxes, partner=partner)

            line.tax_ids = [(6, 0, taxes.ids)]
