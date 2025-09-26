# -*- coding: utf-8 -*-
from odoo import api, fields, models

# Mantén los mismos códigos que usas en el resto del módulo
RUBRO_CODES = [
    ("mano_obra","Mano de Obra"),
    ("uniforme","Uniforme"),
    ("epp","EPP"),
    ("epp_alturas","EPP Alturas"),
    ("equipo_especial_limpieza","Equipo Especial de Limpieza"),
    ("comunicacion_computo","Comunicación y Cómputo"),
    ("herramienta_menor_jardineria","Herramienta Menor de Jardinería"),
    ("material_limpieza","Material de Limpieza"),
    ("perfil_medico","Perfil Médico"),
    ("maquinaria_limpieza","Maquinaria de Limpieza"),
    ("maquinaria_jardineria","Maquinaria de Jardinería"),
    ("fertilizantes_tierra_lama","Fertilizantes y Tierra Lama"),
    ("consumibles_jardineria","Consumibles de Jardinería"),
    ("capacitacion","Capacitación"),
]

class ServiceQuoteAck(models.Model):
    _name = "ccn.service.quote.ack"
    _description = "ACK de 'No aplica' por Sitio/Servicio/Rubro"
    _rec_name = "rubro_code"
    _order = "id desc"

    quote_id = fields.Many2one(
        "ccn.service.quote", required=True, ondelete="cascade", index=True, string="Cotización"
    )
    site_id = fields.Many2one(
        "ccn.service.quote.site", required=True, ondelete="cascade", index=True, string="Sitio"
    )
    service_type = fields.Selection(
        selection=[
            ('jardineria', 'Jardinería'),
            ('limpieza', 'Limpieza'),
            ('mantenimiento', 'Mantenimiento'),
            ('materiales', 'Materiales'),
            ('servicios_especiales', 'Servicios Especiales'),
            ('almacenaje', 'Almacenaje'),
            ('fletes', 'Fletes'),
        ],
        required=True,
        index=True,
        string="Tipo de Servicio",
    )
    rubro_code = fields.Selection(RUBRO_CODES, required=True, index=True, string="Rubro")

    # Nuevo nombre de campo: 'ack' (conserva datos si antes se llamaba is_empty)
    ack = fields.Boolean(string="No aplica", default=True, oldname="is_empty")

    _sql_constraints = [
        ("uniq_ack_scope", "unique(quote_id, site_id, service_type, rubro_code)",
         "Solo puede existir un ACK por sitio, tipo de servicio y rubro."),
    ]
