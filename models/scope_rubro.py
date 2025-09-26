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

class QuoteScopeRubro(models.Model):
    _name = 'ccn.service.quote.scope.rubro'
    _description = 'Bucket: Sitio × Tipo de Servicio × Rubro'
    _order = 'quote_id, site_id, service_type, rubro_id, id'
    _rec_name = 'display_name'

    quote_id = fields.Many2one(
        'ccn.service.quote', required=True, ondelete='cascade', index=True, string='Cotización'
    )
    site_id = fields.Many2one(
        'ccn.service.quote.site', required=True, ondelete='cascade', index=True, string='Sitio'
    )
    service_type = fields.Selection(
        SERVICE_TYPES, required=True, index=True, string='Tipo de Servicio'
    )
    rubro_id = fields.Many2one(
        'ccn.service.rubro', required=True, ondelete='restrict', index=True, string='Rubro'
    )
    # IMPORTANTE: mismo tipo que ccn.service.rubro.code -> Selection related
    rubro_code = fields.Selection(
        related='rubro_id.code', store=True, readonly=True, string='Código de Rubro'
    )

    currency_id = fields.Many2one(
        'res.currency', related='quote_id.currency_id', store=True, readonly=True
    )

    line_ids = fields.One2many(
        'ccn.service.quote.line', 'bucket_id', string='Líneas'
    )

    display_name = fields.Char(
        compute='_compute_display_name', store=True, string='Nombre'
    )

    _sql_constraints = [
        ('uniq_scope', 'unique(quote_id, site_id, service_type, rubro_id)',
         'Ya existe un bucket para ese Sitio/Servicio/Rubro.'),
    ]

    @api.depends('site_id.name', 'service_type', 'rubro_id.name')
    def _compute_display_name(self):
        st_map = dict(SERVICE_TYPES)
        for rec in self:
            s = rec.site_id.name or ''
            st = st_map.get(rec.service_type, rec.service_type or '')
            r = rec.rubro_id.name or ''
            rec.display_name = ' / '.join(p for p in (s, st, r) if p)
