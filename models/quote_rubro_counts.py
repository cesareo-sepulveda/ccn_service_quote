# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuoteRubroCounts(models.Model):
    _inherit = 'ccn.service.quote'

    # NOTA:
    # Los dejamos como Integer almacenados con default=0 para desbloquear la carga de vistas YA.
    # Posteriormente podemos volverlos compute (store=False) con lógica real por rubro.

    rubro_count_mano_obra = fields.Integer(
        string='Count Mano de Obra', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Mano de Obra.')

    rubro_count_uniforme = fields.Integer(
        string='Count Uniforme', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Uniforme.')

    rubro_count_epp = fields.Integer(
        string='Count EPP', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro EPP.')

    rubro_count_epp_alturas = fields.Integer(
        string='Count EPP Alturas', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro EPP para trabajos en alturas.')

    rubro_count_equipo_especial_limpieza = fields.Integer(
        string='Count Equipo Especial de Limpieza', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Equipo Especial de Limpieza.')

    rubro_count_comunicacion_computo = fields.Integer(
        string='Count Comunicación y Cómputo', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Comunicación y Cómputo.')

    rubro_count_herramienta_menor_jardineria = fields.Integer(
        string='Count Herramienta Menor de Jardinería', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Herramienta Menor de Jardinería.')

    rubro_count_material_limpieza = fields.Integer(
        string='Count Material de Limpieza', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Material de Limpieza.')

    rubro_count_perfil_medico = fields.Integer(
        string='Count Perfil Médico', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Perfil Médico.')

    rubro_count_maquinaria_limpieza = fields.Integer(
        string='Count Maquinaria de Limpieza', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Maquinaria de Limpieza.')

    rubro_count_maquinaria_jardineria = fields.Integer(
        string='Count Maquinaria de Jardinería', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Maquinaria de Jardinería.')

    rubro_count_fertilizantes_tierra_lama = fields.Integer(
        string='Count Fertilizantes y Tierra Lama', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Fertilizantes y Tierra Lama.')

    rubro_count_consumibles_jardineria = fields.Integer(
        string='Count Consumibles de Jardinería', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Consumibles de Jardinería.')

    rubro_count_transporte = fields.Integer(
        string='Count Transporte', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Transporte.')

    rubro_count_bienestar = fields.Integer(
        string='Count Bienestar', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Bienestar.')

    rubro_count_capacitacion = fields.Integer(
        string='Count Capacitación', readonly=True,
        compute='_compute_rubro_counts', store=False,
        help='Cantidad de líneas del rubro Capacitación.')

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type',
        'current_site_id', 'current_service_type'
    )
    def _compute_rubro_counts(self):
        def count_for(rec, code):
            lines = rec.line_ids.filtered(lambda l:
                (not rec.current_site_id or l.site_id.id == rec.current_site_id.id) and
                (not rec.current_service_type or l.service_type == rec.current_service_type) and
                ((getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == code)
            )
            return len(lines)

        for rec in self:
            rec.rubro_count_mano_obra                 = count_for(rec, 'mano_obra')
            rec.rubro_count_uniforme                  = count_for(rec, 'uniforme')
            rec.rubro_count_epp                       = count_for(rec, 'epp')
            rec.rubro_count_epp_alturas               = count_for(rec, 'epp_alturas')
            rec.rubro_count_equipo_especial_limpieza  = count_for(rec, 'equipo_especial_limpieza')
            rec.rubro_count_comunicacion_computo      = count_for(rec, 'comunicacion_computo')
            rec.rubro_count_herramienta_menor_jardineria = count_for(rec, 'herramienta_menor_jardineria')
            rec.rubro_count_material_limpieza         = count_for(rec, 'material_limpieza')
            rec.rubro_count_perfil_medico             = count_for(rec, 'perfil_medico')
            rec.rubro_count_maquinaria_limpieza       = count_for(rec, 'maquinaria_limpieza')
            rec.rubro_count_maquinaria_jardineria     = count_for(rec, 'maquinaria_jardineria')
            rec.rubro_count_fertilizantes_tierra_lama = count_for(rec, 'fertilizantes_tierra_lama')
            rec.rubro_count_consumibles_jardineria    = count_for(rec, 'consumibles_jardineria')
            rec.rubro_count_transporte                = count_for(rec, 'transporte') if hasattr(rec, 'rubro_count_transporte') else 0
            rec.rubro_count_bienestar                 = count_for(rec, 'bienestar') if hasattr(rec, 'rubro_count_bienestar') else 0
            rec.rubro_count_capacitacion              = count_for(rec, 'capacitacion')
