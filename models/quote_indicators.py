# -*- coding: utf-8 -*-
"""
Indicadores calculados para mostrar en la vista de cotización.
Por ahora son dummies que retornan valores de ejemplo.
Los cálculos reales se implementarán posteriormente.
"""
from odoo import api, fields, models

class ServiceQuoteIndicators(models.Model):
    _inherit = 'ccn.service.quote'

    # ============================================
    # INDICADORES GENERALES (Todos los sitios)
    # ============================================

    indicator_general_total_elementos = fields.Integer(
        string='Total Elementos',
        compute='_compute_indicators_general',
        help='Total de elementos en todos los servicios y sitios'
    )

    indicator_general_costo_mensual = fields.Monetary(
        string='Costo Mensual Total',
        compute='_compute_indicators_general',
        currency_field='currency_id',
        help='Costo mensual consolidado de todos los servicios'
    )

    indicator_general_personal_requerido = fields.Integer(
        string='Personal Total Requerido',
        compute='_compute_indicators_general',
        help='Total de personal necesario'
    )

    indicator_general_pct_completado = fields.Float(
        string='% Completado',
        compute='_compute_indicators_general',
        help='Porcentaje de completitud general'
    )

    # ============================================
    # INDICADORES POR SITIO ACTUAL
    # ============================================

    indicator_sitio_total_elementos = fields.Integer(
        string='Elementos en Sitio',
        compute='_compute_indicators_sitio',
        help='Total de elementos en el sitio actual'
    )

    indicator_sitio_inversion_inicial = fields.Monetary(
        string='Inversión Inicial',
        compute='_compute_indicators_sitio',
        currency_field='currency_id',
        help='Inversión inicial para el sitio'
    )

    indicator_sitio_costo_mensual = fields.Monetary(
        string='Costo Mensual Sitio',
        compute='_compute_indicators_sitio',
        currency_field='currency_id',
        help='Costo mensual del sitio actual'
    )

    indicator_sitio_personal_total = fields.Integer(
        string='Personal en Sitio',
        compute='_compute_indicators_sitio',
        help='Total de personal en el sitio'
    )

    # Desglose detallado por rubro (sitio completo)
    indicator_sitio_mano_obra = fields.Monetary(string='Mano de Obra', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_mano_obra_pp = fields.Monetary(string='Mano de Obra PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_uniformes = fields.Monetary(string='Uniformes', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_uniformes_pp = fields.Monetary(string='Uniformes PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_epp = fields.Monetary(string='EPP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_epp_pp = fields.Monetary(string='EPP PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_otros_rubros = fields.Monetary(string='Otros Rubros', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_otros_rubros_pp = fields.Monetary(string='Otros Rubros PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_subtotal_1 = fields.Monetary(string='Subtotal 1', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_subtotal_1_pp = fields.Monetary(string='Subtotal 1 PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_utilidad = fields.Monetary(string='Utilidad', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_utilidad_pp = fields.Monetary(string='Utilidad PP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_utilidad_pct = fields.Float(string='Utilidad %', compute='_compute_indicators_sitio')

    indicator_sitio_administracion = fields.Monetary(string='Administración', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_administracion_pp = fields.Monetary(string='Administración PP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_administracion_pct = fields.Float(string='Administración %', compute='_compute_indicators_sitio')

    indicator_sitio_total_mensual_antes_iva = fields.Monetary(string='Total Mensual Antes IVA', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_total_mensual_antes_iva_pp = fields.Monetary(string='Total Mensual Antes IVA PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_iva = fields.Monetary(string='IVA', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_total_mensual_con_iva = fields.Monetary(string='Total Mensual con IVA', compute='_compute_indicators_sitio', currency_field='currency_id')

    # ============================================
    # INDICADORES POR SERVICIO ACTUAL
    # ============================================

    # Campos generales del servicio
    indicator_servicio_total_colaboradores = fields.Integer(
        string='Total de colaboradores',
        compute='_compute_indicators_servicio'
    )

    indicator_servicio_pct_prestaciones = fields.Float(
        string='Porcentaje de prestaciones',
        compute='_compute_indicators_servicio',
        help='Porcentaje de prestaciones sobre el sueldo bruto'
    )

    # Costos por rubro (total y por persona)
    indicator_servicio_sueldo_bruto = fields.Monetary(
        string='Sueldo bruto', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_sueldo_bruto_pp = fields.Monetary(
        string='Sueldo bruto por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_prestaciones = fields.Monetary(
        string='Prestaciones', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_prestaciones_pp = fields.Monetary(
        string='Prestaciones por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_mano_obra = fields.Monetary(
        string='Total Mano de Obra', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_mano_obra_pp = fields.Monetary(
        string='Mano de Obra por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_uniformes = fields.Monetary(
        string='Costo de Uniformes', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_uniformes_pp = fields.Monetary(
        string='Uniformes por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_epp = fields.Monetary(
        string='EPP', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_epp_pp = fields.Monetary(
        string='EPP por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_epp_alturas = fields.Monetary(
        string='EPP Alturas', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_epp_alturas_pp = fields.Monetary(
        string='EPP Alturas por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_comunicacion = fields.Monetary(
        string='Comunicación y Cómputo', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_comunicacion_pp = fields.Monetary(
        string='Comunicación por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_herramienta = fields.Monetary(
        string='Herramienta Menor Jardinería', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_herramienta_pp = fields.Monetary(
        string='Herramienta por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_perfil_medico = fields.Monetary(
        string='Perfil Médico', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_perfil_medico_pp = fields.Monetary(
        string='Perfil Médico por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_maquinaria = fields.Monetary(
        string='Maquinaria de Jardinería', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_maquinaria_pp = fields.Monetary(
        string='Maquinaria por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_fertilizantes = fields.Monetary(
        string='Fertilizantes y Tierra Lama', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_fertilizantes_pp = fields.Monetary(
        string='Fertilizantes por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_consumibles = fields.Monetary(
        string='Consumibles Jardinería', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_consumibles_pp = fields.Monetary(
        string='Consumibles por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_capacitacion = fields.Monetary(
        string='Capacitación', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_capacitacion_pp = fields.Monetary(
        string='Capacitación por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    # Campos específicos de limpieza
    indicator_servicio_material_limpieza = fields.Monetary(
        string='Material de Limpieza', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_material_limpieza_pp = fields.Monetary(
        string='Material Limpieza por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_maquinaria_limpieza = fields.Monetary(
        string='Maquinaria de Limpieza', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_maquinaria_limpieza_pp = fields.Monetary(
        string='Maquinaria Limpieza por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    indicator_servicio_equipo_especial = fields.Monetary(
        string='Equipo Especial de Limpieza', compute='_compute_indicators_servicio', currency_field='currency_id')
    indicator_servicio_equipo_especial_pp = fields.Monetary(
        string='Equipo Especial por persona', compute='_compute_indicators_servicio', currency_field='currency_id')

    # TOTAL del servicio
    indicator_servicio_total = fields.Monetary(
        string='Total Servicio',
        compute='_compute_indicators_servicio',
        currency_field='currency_id'
    )

    indicator_servicio_total_pp = fields.Monetary(
        string='Total por persona',
        compute='_compute_indicators_servicio',
        currency_field='currency_id'
    )

    # ============================================
    # MÉTODOS COMPUTE (Valores dummy por ahora)
    # ============================================

    @api.depends('line_ids', 'site_ids')
    def _compute_indicators_general(self):
        """
        Calcula indicadores generales (todos los sitios).
        TODO: Implementar cálculos reales basados en line_ids
        """
        for rec in self:
            # Valores dummy - reemplazar con cálculos reales
            rec.indicator_general_total_elementos = 77
            rec.indicator_general_costo_mensual = 43000.00
            rec.indicator_general_personal_requerido = 8
            rec.indicator_general_pct_completado = 88.5

    @api.depends('line_ids', 'current_site_id')
    def _compute_indicators_sitio(self):
        """
        Calcula indicadores del sitio actual.
        TODO: Filtrar line_ids por current_site_id y calcular valores reales
        """
        for rec in self:
            # Valores dummy basados en el ejemplo - reemplazar con cálculos reales
            total_colaboradores = 7  # Dummy

            # Rubros principales (dummy values)
            mano_obra = 36027.43
            uniformes = 2153.33
            epp = 3313.92
            otros_rubros = 85533.19  # Suma de todos los demás rubros

            subtotal_1 = mano_obra + uniformes + epp + otros_rubros  # 127,027.87

            # Porcentajes configurables
            utilidad_pct = rec.utility_percent or 11.90  # 11.90%
            admin_pct = rec.admin_percent or 11.00  # 11.00%

            utilidad = subtotal_1 * (utilidad_pct / 100)  # 15,114.22
            administracion = subtotal_1 * (admin_pct / 100)  # 13,973.07

            total_mensual_antes_iva = subtotal_1 + utilidad + administracion  # 156,115.16
            iva = total_mensual_antes_iva * 0.16  # 24,978.43
            total_mensual_con_iva = total_mensual_antes_iva + iva  # 181,093.59

            # Asignar valores totales
            rec.indicator_sitio_mano_obra = mano_obra
            rec.indicator_sitio_uniformes = uniformes
            rec.indicator_sitio_epp = epp
            rec.indicator_sitio_otros_rubros = otros_rubros
            rec.indicator_sitio_subtotal_1 = subtotal_1
            rec.indicator_sitio_utilidad = utilidad
            rec.indicator_sitio_utilidad_pct = utilidad_pct
            rec.indicator_sitio_administracion = administracion
            rec.indicator_sitio_administracion_pct = admin_pct
            rec.indicator_sitio_total_mensual_antes_iva = total_mensual_antes_iva
            rec.indicator_sitio_iva = iva
            rec.indicator_sitio_total_mensual_con_iva = total_mensual_con_iva

            # Per person values
            if total_colaboradores > 0:
                rec.indicator_sitio_mano_obra_pp = mano_obra / total_colaboradores
                rec.indicator_sitio_uniformes_pp = uniformes / total_colaboradores
                rec.indicator_sitio_epp_pp = epp / total_colaboradores
                rec.indicator_sitio_otros_rubros_pp = otros_rubros / total_colaboradores
                rec.indicator_sitio_subtotal_1_pp = subtotal_1 / total_colaboradores
                rec.indicator_sitio_utilidad_pp = utilidad / total_colaboradores
                rec.indicator_sitio_administracion_pp = administracion / total_colaboradores
                rec.indicator_sitio_total_mensual_antes_iva_pp = total_mensual_antes_iva / total_colaboradores
            else:
                rec.indicator_sitio_mano_obra_pp = 0
                rec.indicator_sitio_uniformes_pp = 0
                rec.indicator_sitio_epp_pp = 0
                rec.indicator_sitio_otros_rubros_pp = 0
                rec.indicator_sitio_subtotal_1_pp = 0
                rec.indicator_sitio_utilidad_pp = 0
                rec.indicator_sitio_administracion_pp = 0
                rec.indicator_sitio_total_mensual_antes_iva_pp = 0

            # Valores legacy (mantener compatibilidad)
            rec.indicator_sitio_total_elementos = 45
            rec.indicator_sitio_inversion_inicial = 150000.00
            rec.indicator_sitio_costo_mensual = total_mensual_antes_iva
            rec.indicator_sitio_personal_total = total_colaboradores

    @api.depends('line_ids', 'current_site_id', 'current_service_type', 'prestaciones_percent')
    def _compute_indicators_servicio(self):
        """
        Calcula indicadores del servicio actual en el sitio actual.
        TODO: Filtrar line_ids por current_site_id y current_service_type y calcular valores reales
        """
        for rec in self:
            # Valores dummy basados en la imagen de ejemplo - reemplazar con cálculos reales
            total_colaboradores = 6
            pct_prestaciones = rec.prestaciones_percent or 45.0

            # Valores dummy de ejemplo (Jardinería)
            sueldo_bruto = 25622.86
            prestaciones = 11530.29
            mano_obra = 37153.14
            uniformes = 1400.00
            epp = 2905.00
            epp_alturas = 11530.29
            comunicacion = 37153.14
            herramienta = 1400.00
            perfil_medico = 2905.00
            maquinaria = 11530.29
            fertilizantes = 37153.14
            consumibles = 1400.00
            capacitacion = 2905.00

            # Asignaciones dummy
            rec.indicator_servicio_total_colaboradores = total_colaboradores
            rec.indicator_servicio_pct_prestaciones = pct_prestaciones

            rec.indicator_servicio_sueldo_bruto = sueldo_bruto
            rec.indicator_servicio_sueldo_bruto_pp = sueldo_bruto / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_prestaciones = prestaciones
            rec.indicator_servicio_prestaciones_pp = prestaciones / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_mano_obra = mano_obra
            rec.indicator_servicio_mano_obra_pp = mano_obra / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_uniformes = uniformes
            rec.indicator_servicio_uniformes_pp = uniformes / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_epp = epp
            rec.indicator_servicio_epp_pp = epp / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_epp_alturas = epp_alturas
            rec.indicator_servicio_epp_alturas_pp = epp_alturas / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_comunicacion = comunicacion
            rec.indicator_servicio_comunicacion_pp = comunicacion / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_herramienta = herramienta
            rec.indicator_servicio_herramienta_pp = herramienta / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_perfil_medico = perfil_medico
            rec.indicator_servicio_perfil_medico_pp = perfil_medico / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_maquinaria = maquinaria
            rec.indicator_servicio_maquinaria_pp = maquinaria / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_fertilizantes = fertilizantes
            rec.indicator_servicio_fertilizantes_pp = fertilizantes / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_consumibles = consumibles
            rec.indicator_servicio_consumibles_pp = consumibles / total_colaboradores if total_colaboradores > 0 else 0

            rec.indicator_servicio_capacitacion = capacitacion
            rec.indicator_servicio_capacitacion_pp = capacitacion / total_colaboradores if total_colaboradores > 0 else 0

            # Campos de limpieza (dummy en 0 por ahora)
            rec.indicator_servicio_material_limpieza = 0.0
            rec.indicator_servicio_material_limpieza_pp = 0.0
            rec.indicator_servicio_maquinaria_limpieza = 0.0
            rec.indicator_servicio_maquinaria_limpieza_pp = 0.0
            rec.indicator_servicio_equipo_especial = 0.0
            rec.indicator_servicio_equipo_especial_pp = 0.0

            # Total del servicio (suma de todos los rubros)
            total = (mano_obra + uniformes + epp + epp_alturas + comunicacion + herramienta +
                    perfil_medico + maquinaria + fertilizantes + consumibles + capacitacion)

            rec.indicator_servicio_total = total
            rec.indicator_servicio_total_pp = total / total_colaboradores if total_colaboradores > 0 else 0

    # ============================================
    # MÉTODOS DE ACCIÓN
    # ============================================

    def action_show_general_summary(self):
        """Abre el wizard con el resumen general"""
        self.ensure_one()
        return {
            'name': 'Resumen General',
            'type': 'ir.actions.act_window',
            'res_model': 'ccn.general.summary.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_quote_id': self.id},
        }

    def action_generate_full_pdf(self):
        """Genera un PDF con todas las tablas de indicadores"""
        self.ensure_one()
        # TODO: Implementar reporte PDF
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'PDF en Desarrollo',
                'message': 'La funcionalidad de PDF se implementará próximamente.',
                'type': 'info',
                'sticky': False,
            }
        }
