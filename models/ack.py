# -*- coding: utf-8 -*-
from odoo import api, fields, models


RUBRO_SELECTION = [
    ('mano_obra', 'Mano de Obra'),
    ('uniforme', 'Uniforme'),
    ('epp', 'EPP'),
    ('epp_alturas', 'EPP Alturas'),
    ('equipo_especial_limpieza', 'Equipo Especial de Limpieza'),
    ('comunicacion_computo', 'Comunicación y Cómputo'),
    ('herramienta_menor_jardineria', 'Herramienta Menor Jardinería'),
    ('material_limpieza', 'Material de Limpieza'),
    ('perfil_medico', 'Perfil Médico'),
    ('maquinaria_limpieza', 'Maquinaria de Limpieza'),
    ('maquinaria_jardineria', 'Maquinaria de Jardinería'),
    ('fertilizantes_tierra_lama', 'Fertilizantes y Tierra Lama'),
    ('consumibles_jardineria', 'Consumibles de Jardinería'),
    ('capacitacion', 'Capacitación'),
]

SERVICE_TYPE_SELECTION = [
    ('jardineria', 'Jardinería'),
    ('limpieza', 'Limpieza'),
    ('mantenimiento', 'Mantenimiento'),
    ('materiales', 'Materiales'),
    ('servicios_especiales', 'Servicios Especiales'),
    ('almacenaje', 'Almacenaje'),
    ('fletes', 'Fletes'),
]


class ServiceQuoteAck(models.Model):
    _name = "ccn.service.quote.ack"
    _description = "ACK de rubro por sitio y tipo de servicio"
    _rec_name = "rubro_code"
    _order = "id desc"

    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one('ccn.service.quote.site', string='Sitio', required=True, ondelete='cascade', index=True)
    service_type = fields.Selection(SERVICE_TYPE_SELECTION, string='Tipo de servicio', required=True, index=True)
    rubro_code = fields.Selection(RUBRO_SELECTION, string='Rubro', required=True, index=True)
    is_empty = fields.Boolean(string="No aplica", default=True)

    _sql_constraints = [
        (
            'ccn_ack_unique_scope',
            'unique(quote_id, site_id, service_type, rubro_code)',
            'Ya existe un ACK para ese Sitio/Tipo de servicio/Rubro.'
        ),
    ]

    @api.constrains('site_id', 'quote_id')
    def _check_site_belongs_to_quote(self):
        for rec in self:
            if rec.site_id and rec.quote_id and rec.site_id.quote_id != rec.quote_id:
                raise models.ValidationError("El sitio del ACK pertenece a otra cotización.")
