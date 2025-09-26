# -*- coding: utf-8 -*-
from odoo import api, SUPERUSER_ID

def post_init_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Quote = env['ccn.service.quote'].sudo()
    Site = env['ccn.service.quote.site'].sudo()
    Line = env['ccn.service.quote.line'].sudo()

    # Recorre todas las cotizaciones; si tu BD es enorme, podrías hacerlo por lotes
    quotes = Quote.search([])
    for q in quotes:
        # Todos los sitios "general" (case-insensitive) de ESTA cotización
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
            # Elige uno canónico y archiva/combina duplicados
            canonical = generals.sorted(key=lambda s: ((s.sequence or 0), s.id))[0]
            dups = (generals - canonical)
            if dups:
                # Reasigna líneas de los duplicados al canónico para no perder datos
                Line.search([('site_id', 'in', dups.ids)]).write({'site_id': canonical.id})
                dups.write({'active': False})

        # Asegura que el canónico esté activo y al frente
        canonical.write({'active': True, 'sequence': -999})

        # Si la cotización no tiene sitio actual o apunta a algo inválido, usa el "General"
        if not q.current_site_id or q.current_site_id not in q.site_ids:
            q.current_site_id = canonical.id
