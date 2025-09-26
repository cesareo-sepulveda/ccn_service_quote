# -*- coding: utf-8 -*-
import logging
from odoo import api, models

_logger = logging.getLogger(__name__)


class ServiceQuoteLineDefaults(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Asegura que la línea “nueva” (en memoria, antes de guardar) ya tenga el
    # alcance correcto: quote, sitio, tipo de servicio y rubro.
    @api.model
    def default_get(self, fields_list):
        vals = super().default_get(fields_list)
        ctx = self.env.context or {}

        # quote / site / service_type desde el contexto del notebook
        qid = ctx.get('default_quote_id')
        sid = ctx.get('default_site_id')
        st  = ctx.get('default_service_type')
        code = ctx.get('ctx_rubro_code')

        if 'quote_id' in fields_list and not vals.get('quote_id') and qid:
            vals['quote_id'] = qid
        if 'site_id' in fields_list and not vals.get('site_id') and sid:
            vals['site_id'] = sid
        if 'service_type' in fields_list and not vals.get('service_type') and st:
            vals['service_type'] = st

        # rubro desde el código de la pestaña
        if 'rubro_id' in fields_list and not vals.get('rubro_id') and code:
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                vals['rubro_id'] = rubro.id

        return vals

    # “Cinturón y tirantes”: al guardar, si algo faltó, lo completamos igual.
    @api.model_create_multi
    def create(self, vals_list):
        Rubro = self.env['ccn.service.rubro']
        ctx = self.env.context or {}
        qid = ctx.get('default_quote_id')
        sid = ctx.get('default_site_id')
        st  = ctx.get('default_service_type')
        code = ctx.get('ctx_rubro_code')

        for vals in vals_list:
            # quote / sitio / tipo servicio por si el cliente creó desde otra UI
            if qid and not vals.get('quote_id'):
                vals['quote_id'] = qid
            if sid and not vals.get('site_id'):
                vals['site_id'] = sid
            if st and not vals.get('service_type'):
                vals['service_type'] = st

            # rubro por código de pestaña
            if code and not vals.get('rubro_id'):
                rubro = Rubro.search([('code', '=', code)], limit=1)
                if rubro:
                    vals['rubro_id'] = rubro.id

            # como fallback, si viene producto con 1 solo rubro en la plantilla
            if not vals.get('rubro_id') and vals.get('product_id'):
                prod = self.env['product.product'].browse(vals['product_id'])
                tmpl_rubros = prod.product_tmpl_id.sudo().ccn_rubro_ids
                if len(tmpl_rubros) == 1:
                    vals['rubro_id'] = tmpl_rubros.id

        records = super().create(vals_list)
        return records
