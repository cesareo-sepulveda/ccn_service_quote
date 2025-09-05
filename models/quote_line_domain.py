# -*- coding: utf-8 -*-
from odoo import models, api

class CCNServiceQuoteLine(models.Model):
    _inherit = 'ccn.service.quote.line'

    @api.onchange('rubro_id')
    def _onchange_rubro_id_set_product_domain(self):
        """
        Filtra product_id: solo sale el catálogo con el rubro elegido y excluye
        plantillas marcadas como ccn_exclude_from_quote. Si no hay rubro, no muestra nada.
        """
        domain = [('sale_ok', '=', True), ('product_tmpl_id.ccn_exclude_from_quote', '=', False)]
        if self.rubro_id:
            domain.append(('product_tmpl_id.ccn_rubro_ids', 'in', [self.rubro_id.id]))
            if self.product_id and self.rubro_id not in self.product_id.product_tmpl_id.ccn_rubro_ids:
                self.product_id = False
        else:
            domain.append(('id', '=', 0))
            self.product_id = False
        return {'domain': {'product_id': domain}}
