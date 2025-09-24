from odoo import api, SUPERUSER_ID

def post_init_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Site = env['ccn.service.quote.site'].sudo()
    imd = env['ir.model.data'].sudo()

    general = env.ref('ccn_service_quote.site_general', raise_if_not_found=False)
    if not general:
        general = Site.search([('name', '=ilike', 'general')], limit=1) or \
                  Site.create({'name': 'General', 'active': True, 'sequence': -999})
        imd.create({
            'name': 'site_general',
            'module': 'ccn_service_quote',
            'model': 'ccn.service.quote.site',
            'res_id': general.id,
            'noupdate': True,
        })

    # Reactiva y fija orden
    vals = {'active': True, 'sequence': -999}
    # Si existe company_id en el modelo, hazlo global para que siempre sea visible
    if 'company_id' in Site._fields:
        vals['company_id'] = False
    general.write(vals)

    # Fusiona duplicados (si alguien subió datos viejos)
    dupes = Site.search([('name', '=ilike', 'general')])
    dupes_to_merge = dupes - general
    if dupes_to_merge:
        env['ccn.service.quote'].sudo().search([('site_id', 'in', dupes_to_merge.ids)]).write({'site_id': general.id})
        dupes_to_merge.write({'active': False})

    # Guarda como parámetro por si lo usas en defaults
    env['ir.config_parameter'].sudo().set_param('ccn_service_quote.default_site_id', general.id)
