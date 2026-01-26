# -*- coding: utf-8 -*-
from . import models
from . import wizard
from . import wizards

# Hook inline para que Odoo lo encuentre sin archivo extra
from odoo import api, SUPERUSER_ID

def post_init_hook(*args):
    """Hook compatible con Odoo 16 y 17+."""
    if len(args) == 1 and isinstance(args[0], api.Environment):
        env = args[0]
    elif len(args) == 2:  # (cr, registry) -> construir env de superusuario
        cr, _registry = args
        env = api.Environment(cr, SUPERUSER_ID, {})
    else:
        raise TypeError("post_init_hook: firma no soportada: %r" % (args,))
    Quote = env['ccn.service.quote'].sudo()
    Site = env['ccn.service.quote.site'].sudo()
    Line = env['ccn.service.quote.line'].sudo()

    quotes = Quote.search([])
    for q in quotes:
        generals = q.site_ids.with_context(active_test=False).filtered(lambda s: (s.name or '').strip().lower() == 'general')
        if not generals:
            canonical = Site.create({'quote_id': q.id, 'name': 'General', 'active': True, 'sequence': -999})
        else:
            canonical = generals.sorted(key=lambda s: ((s.sequence or 0), s.id))[0]
            dups = generals - canonical
            if dups:
                Line.search([('site_id', 'in', dups.ids)]).write({'site_id': canonical.id})
                dups.write({'active': False})
        canonical.write({'active': True, 'sequence': -999})
        if not q.current_site_id or q.current_site_id not in q.site_ids:
            q.current_site_id = canonical.id
