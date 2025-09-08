from odoo import api, fields, models

class CcnServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'Línea de cotización CCN'

    quote_id   = fields.Many2one('ccn.service.quote', required=True, ondelete='cascade')
    rubro_id   = fields.Many2one('ccn.service.rubro', required=True)
    product_id = fields.Many2one('product.product')  # si usas product_tmpl_id, ajusta abajo

    @api.model
    def default_get(self, fields_list):
        vals = super().default_get(fields_list)
        code = self.env.context.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not vals.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                vals['rubro_id'] = rubro.id
        return vals

    @api.onchange('rubro_id')
    def _onchange_rubro_from_ctx(self):
        # Si el usuario borra el rubro y existe ctx_rubro_code, vuelve a fijarlo
        if not self.rubro_id and self.env.context.get('ctx_rubro_code'):
            rubro = self.env['ccn.service.rubro'].search([('code','=', self.env.context['ctx_rubro_code'])], limit=1)
            if rubro:
                self.rubro_id = rubro.id
