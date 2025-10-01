# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceQuoteRubroCounts(models.Model):
    _inherit = 'ccn.service.quote'

    # NOTA:
    # Los dejamos como Integer almacenados con default=0 para desbloquear la carga de vistas YA.
    # Posteriormente podemos volverlos compute (store=False) con lógica real por rubro.

    rubro_count_mano_obra = fields.Integer(
        string='Count Mano de Obra', default=0, readonly=True,
        help='Cantidad de líneas del rubro Mano de Obra.')

    rubro_count_uniforme = fields.Integer(
        string='Count Uniforme', default=0, readonly=True,
        help='Cantidad de líneas del rubro Uniforme.')

    rubro_count_epp = fields.Integer(
        string='Count EPP', default=0, readonly=True,
        help='Cantidad de líneas del rubro EPP.')

    rubro_count_epp_alturas = fields.Integer(
        string='Count EPP Alturas', default=0, readonly=True,
        help='Cantidad de líneas del rubro EPP para trabajos en alturas.')

    rubro_count_equipo_especial_limpieza = fields.Integer(
        string='Count Equipo Especial de Limpieza', default=0, readonly=True,
        help='Cantidad de líneas del rubro Equipo Especial de Limpieza.')

    rubro_count_comunicacion_computo = fields.Integer(
        string='Count Comunicación y Cómputo', default=0, readonly=True,
        help='Cantidad de líneas del rubro Comunicación y Cómputo.')

    rubro_count_herramienta_menor_jardineria = fields.Integer(
        string='Count Herramienta Menor de Jardinería', default=0, readonly=True,
        help='Cantidad de líneas del rubro Herramienta Menor de Jardinería.')

    rubro_count_material_limpieza = fields.Integer(
        string='Count Material de Limpieza', default=0, readonly=True,
        help='Cantidad de líneas del rubro Material de Limpieza.')

    rubro_count_perfil_medico = fields.Integer(
        string='Count Perfil Médico', default=0, readonly=True,
        help='Cantidad de líneas del rubro Perfil Médico.')

    rubro_count_maquinaria_limpieza = fields.Integer(
        string='Count Maquinaria de Limpieza', default=0, readonly=True,
        help='Cantidad de líneas del rubro Maquinaria de Limpieza.')

    rubro_count_maquinaria_jardineria = fields.Integer(
        string='Count Maquinaria de Jardinería', default=0, readonly=True,
        help='Cantidad de líneas del rubro Maquinaria de Jardinería.')

    rubro_count_fertilizantes_tierra_lama = fields.Integer(
        string='Count Fertilizantes y Tierra Lama', default=0, readonly=True,
        help='Cantidad de líneas del rubro Fertilizantes y Tierra Lama.')

    rubro_count_consumibles_jardineria = fields.Integer(
        string='Count Consumibles de Jardinería', default=0, readonly=True,
        help='Cantidad de líneas del rubro Consumibles de Jardinería.')

    rubro_count_transporte = fields.Integer(
        string='Count Transporte', default=0, readonly=True,
        help='Cantidad de líneas del rubro Transporte.')

    rubro_count_bienestar = fields.Integer(
        string='Count Bienestar', default=0, readonly=True,
        help='Cantidad de líneas del rubro Bienestar.')

    rubro_count_capacitacion = fields.Integer(
        string='Count Capacitación', default=0, readonly=True,
        help='Cantidad de líneas del rubro Capacitación.')
