# -*- coding: utf-8 -*-
from odoo import api, fields, models

SERVICE_TYPES = [
    ('jardineria', 'Jardinería'),
    ('limpieza', 'Limpieza'),
    ('mantenimiento', 'Mantenimiento'),
    ('materiales', 'Materiales'),
    ('servicios_especiales', 'Servicios Especiales'),
    ('almacenaje', 'Almacenaje'),
    ('fletes', 'Fletes'),
]

class CCNServiceQuoteScopeRubro(models.Model):
    _name = 'ccn.service.quote.scope.rubro'
    _description = 'Ámbito por Rubro (Sitio × Tipo de Servicio × Rubro)'
    _order = 'id'

    quote_id = fields.Many2one('ccn.service.quote', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one('ccn.service.quote.site', required=True, ondelete='cascade', index=True)
    service_type = fields.Selection(SERVICE_TYPES, required=True, index=True)
    rubro_id = fields.Many2one('ccn.service.rubro', required=True, index=True)
    rubro_code = fields.Char(related='rubro_id.code', store=True, index=True)

    currency_id = fields.Many2one('res.currency', related='quote_id.currency_id', store=True, readonly=True)

    name = fields.Char(string='Nombre', compute='_compute_name', store=True)
    line_ids = fields.One2many('ccn.service.quote.line', 'bucket_id', string='Líneas')

    _sql_constraints = [
        ('uniq_scope_rubro', 'unique(quote_id, site_id, service_type, rubro_id)',
         'Ya existe un bucket para ese Sitio, Tipo de servicio y Rubro en esta cotización.')
    ]

    @api.depends('quote_id.name', 'site_id.name', 'service_type', 'rubro_id.name')
    def _compute_name(self):
        for r in self:
            q = r.quote_id.name or ''
            s = r.site_id.name or ''
            st = r.service_type or ''
            rb = r.rubro_id.name or ''
            r.name = f"{q} • {s} • {st} • {rb}"
