# -*- coding: utf-8 -*-
from odoo import fields, models

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

class CCNServiceRubro(models.Model):
    _name = "ccn.service.rubro"
    _description = "Rubro Cotizador"
    _order = "sequence, name"

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)

    # Fijo para fórmulas y tabs
    code = fields.Selection(RUBRO_CODES, string="Código fijo", required=False, index=True)

    # Aplicabilidad por tipo
    apply_garden = fields.Boolean(string="Aplica Jardinería", default=False)
    apply_clean  = fields.Boolean(string="Aplica Limpieza", default=False)

    # Visibilidad externa
    internal_only = fields.Boolean(
        string="Solo interno",
        help="Si está marcado, este rubro NO se muestra al cliente.",
        default=False,
    )
    active = fields.Boolean(default=True)

    # >>> Productos permitidos para este rubro (clave para filtrar product_id en líneas)
    allowed_product_ids = fields.Many2many(
        'product.product',
        'ccn_rubro_product_rel',   # tabla rel
        'rubro_id',                # columna FK a este modelo
        'product_id',              # columna FK al producto
        string='Productos permitidos',
        help="Sólo estos productos podrán seleccionarse en las líneas que usen este rubro."
    )

    _sql_constraints = [
        ("uniq_code", "unique(code)", "El código de rubro debe ser único."),
    ]
