# -*- coding: utf-8 -*-
from . import models
from . import wizard

# Hook inline para que Odoo lo encuentre sin importar archivos extra
from odoo import api, SUPERUSER_ID

def post_init_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Quote = env['ccn.service.quote'].sudo()
    Site = env['ccn.service.quote.site'].sudo()
    Line = env['ccn.service.quote.line'].sudo()

    # Recorre todas las cotizaciones y garantiza UN 'General' por cada una.
    quotes = Quote.search([])
    for q in quotes:
        generals = q.site_ids.filtered(lambda s: (s.name or '').strip().lower() == 'general')

        if not generals:
            # No existe "General" -> créalo
            canonical = Site.create({
                'quote_id': q.id,
                'name': 'General',
                'active': True,
                'sequence': -999,
            })
        else:
            # Elige canónico y fusiona duplicados dentro de la misma cotización
            canonical = generals.sorted(key=lambda s: ((s.sequence or 0), s.id))[0]
            dups = (generals - canonical)
            if dups:
                Line.search([('site_id', 'in', dups.ids)]).write({'site_id': canonical.id})
                dups.write({'active': False})

        # Activo y al tope
        canonical.write({'active': True, 'sequence': -999})

        # Si la cotización no tiene sitio actual o es inválido, apunta al "General"
        if not q.current_site_id or q.current_site_id not in q.site_ids:
            q.current_site_id = canonical.id
