# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceRubro(models.Model):
    _name = "ccn.service.rubro"
    _description = "Rubro CCN"
    _order = "sequence, name"

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10, help="Controla el orden 1..14 en UI y reportes.")

    # Código estable (string) para lógica y cálculos
    code = fields.Selection([
        ("mano_obra", "Mano de Obra"),
        ("uniforme", "Uniforme"),
        ("epp", "EPP"),
        ("epp_alturas", "EPP Alturas"),
        ("equipo_especial_limpieza", "Equipo Especial de Limpieza"),
        ("comunicacion_computo", "Comunicación y Cómputo"),
        ("herramienta_menor_jardineria", "Herr. Menor Jardinería"),
        ("material_limpieza", "Material de Limpieza"),
        ("perfil_medico", "Perfil Médico"),
        ("maquinaria_limpieza", "Maquinaria de Limpieza"),
        ("maquinaria_jardineria", "Maquinaria de Jardinería"),
        ("fertilizantes_tierra_lama", "Fertilizantes y Tierra Lama"),
        ("consumibles_jardineria", "Consumibles de Jardinería"),
        ("capacitacion", "Capacitación"),
    ], required=True, index=True, string="Código fijo", help="Identificador estable para cálculos.")

    apply_garden = fields.Boolean(string="Aplica Jardinería", default=False)
    apply_clean  = fields.Boolean(string="Aplica Limpieza", default=False)

    internal_only = fields.Boolean(
        string="Solo interno",
        help="Si está marcado, este rubro NO debe mostrarse al cliente en la SO o reportes.",
        default=False,
    )
    active = fields.Boolean(default=True)
# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceRubro(models.Model):
    _name = "ccn.service.rubro"
    _description = "Rubro CCN"
    _order = "sequence, name"

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10, help="Controla el orden 1..14 en UI y reportes.")

    # Código estable (string) para lógica y cálculos
    code = fields.Selection([
        ("mano_obra", "Mano de Obra"),
        ("uniforme", "Uniforme"),
        ("epp", "EPP"),
        ("epp_alturas", "EPP Alturas"),
        ("equipo_especial_limpieza", "Equipo Especial de Limpieza"),
        ("comunicacion_computo", "Comunicación y Cómputo"),
        ("herramienta_menor_jardineria", "Herr. Menor Jardinería"),
        ("material_limpieza", "Material de Limpieza"),
        ("perfil_medico", "Perfil Médico"),
        ("maquinaria_limpieza", "Maquinaria de Limpieza"),
        ("maquinaria_jardineria", "Maquinaria de Jardinería"),
        ("fertilizantes_tierra_lama", "Fertilizantes y Tierra Lama"),
        ("consumibles_jardineria", "Consumibles de Jardinería"),
        ("capacitacion", "Capacitación"),
    ], index=True, string="Código fijo", help="Identificador estable para cálculos.")

    apply_garden = fields.Boolean(string="Aplica Jardinería", default=False)
    apply_clean  = fields.Boolean(string="Aplica Limpieza", default=False)

    internal_only = fields.Boolean(
        string="Solo interno",
        help="Si está marcado, este rubro NO debe mostrarse al cliente en la SO o reportes.",
        default=False,
    )
    active = fields.Boolean(default=True)
