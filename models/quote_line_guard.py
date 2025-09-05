# -*- coding: utf-8 -*-
from odoo import models, api, _
from odoo.exceptions import ValidationError

class CCNServiceQuoteLineGuard(models.Model):
    _inherit = 'ccn.service.quote.line'

    @api.constrains('product_id', 'rubro_id')
    def _check_product_matches_rubro(self):
        for rec in self:
            if rec.product_id:
                if not rec.rubro_id:
                    raise ValidationError(_("Seleccione un Rubro antes de elegir el Producto."))

                tmpl = rec.product_id.product_tmpl_id
                # Debe pertenecer al rubro y no estar excluido del selector
                if rec.rubro_id not in tmpl.ccn_rubro_ids or tmpl.ccn_exclude_from_quote:
                    raise ValidationError(
                        _("El producto '%s' no pertenece al Rubro '%s' o está marcado para no usarse en CCN Service Quote.")
                        % (rec.product_id.display_name, rec.rubro_id.display_name)
                    )
