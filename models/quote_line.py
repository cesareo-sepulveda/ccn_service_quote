"""Helpers for the ``ccn.service.quote.line`` model.

This file only adds behavior to the base model defined in
``service_quote.py``.  Previously the model was redefined here using the
``_name`` attribute which caused Odoo to drop fields (such as
``site_id``) declared in the original class.  As a consequence the module
failed to install with ``KeyError: 'site_id'`` during the registry
loading phase.

To avoid overriding the base definition we now use ``_inherit`` and only
declare the helper methods.  The fields ``quote_id``, ``rubro_id`` and
``product_id`` are already provided by the base model so they are no
longer duplicated here.
"""

from odoo import api, models, fields


class CcnServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    quote_id  = fields.Many2one('ccn.service.quote', index=True)          # ya suele venir indexado, lo explicitamos
    site_id   = fields.Many2one('ccn.service.quote.site', index=True)
    rubro_id  = fields.Many2one('ccn.service.rubro', index=True)
    product_id= fields.Many2one('product.product', index=True)
    #type      = fields.Selection([...], index=True)  # añade index=True en el Selection
    
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
