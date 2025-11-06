# -*- coding: utf-8 -*-
"""
Indicadores calculados para mostrar en la vista de cotización.
Los indicadores se calculan en tiempo real basándose en las líneas de cotización (line_ids).

Tres niveles de indicadores:
1. Generales: Totales consolidados de toda la cotización
2. Por Sitio: Totales del sitio actual (todos los servicios del sitio)
3. Por Servicio: Totales del servicio actual en el sitio actual (detalle por rubro)
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

    indicator_sitio_epp_alturas = fields.Monetary(string='EPP Alturas', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_epp_alturas_pp = fields.Monetary(string='EPP Alturas PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_equipo_especial = fields.Monetary(string='Equipo Especial', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_equipo_especial_pp = fields.Monetary(string='Equipo Especial PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_comunicacion = fields.Monetary(string='Comunicación', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_comunicacion_pp = fields.Monetary(string='Comunicación PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_herramienta = fields.Monetary(string='Herramienta', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_herramienta_pp = fields.Monetary(string='Herramienta PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_material_limpieza = fields.Monetary(string='Material Limpieza', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_material_limpieza_pp = fields.Monetary(string='Material Limpieza PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_otros_rubros = fields.Monetary(string='Otros Rubros', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_otros_rubros_pp = fields.Monetary(string='Otros Rubros PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_subtotal_1 = fields.Monetary(string='Subtotal 1', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_subtotal_1_pp = fields.Monetary(string='Subtotal 1 PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_administracion = fields.Monetary(string='Administración', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_administracion_pp = fields.Monetary(string='Administración PP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_administracion_pct = fields.Float(string='Administración %', compute='_compute_indicators_sitio')

    indicator_sitio_utilidad = fields.Monetary(string='Utilidad', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_utilidad_pp = fields.Monetary(string='Utilidad PP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_utilidad_pct = fields.Float(string='Utilidad %', compute='_compute_indicators_sitio')

    indicator_sitio_subtotal_2 = fields.Monetary(string='Subtotal 2', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_subtotal_2_pp = fields.Monetary(string='Subtotal 2 PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_perfil_medico = fields.Monetary(string='Perfil Médico', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_perfil_medico_pp = fields.Monetary(string='Perfil Médico PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_maquinaria_limpieza = fields.Monetary(string='Maquinaria Limpieza', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_maquinaria_limpieza_pp = fields.Monetary(string='Maquinaria Limpieza PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_maquinaria_jardineria = fields.Monetary(string='Maquinaria Jardinería', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_maquinaria_jardineria_pp = fields.Monetary(string='Maquinaria Jardinería PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_fertilizantes = fields.Monetary(string='Fertilizantes y Tierra Lama', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_fertilizantes_pp = fields.Monetary(string='Fertilizantes PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_consumibles = fields.Monetary(string='Consumibles Jardinería', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_consumibles_pp = fields.Monetary(string='Consumibles PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_transporte = fields.Monetary(string='Transporte', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_transporte_pp = fields.Monetary(string='Transporte PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_bienestar = fields.Monetary(string='Bienestar', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_bienestar_pp = fields.Monetary(string='Bienestar PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_capacitacion = fields.Monetary(string='Capacitación', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_capacitacion_pp = fields.Monetary(string='Capacitación PP', compute='_compute_indicators_sitio', currency_field='currency_id')

    indicator_sitio_costo_financiero = fields.Monetary(string='Costo Financiero', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_costo_financiero_pp = fields.Monetary(string='Costo Financiero PP', compute='_compute_indicators_sitio', currency_field='currency_id')
    indicator_sitio_costo_financiero_pct = fields.Float(string='Costo Financiero %', compute='_compute_indicators_sitio')

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
    # MÉTODOS COMPUTE (Cálculos reales)
    # ============================================

    @api.depends('line_ids', 'line_ids.total_price', 'site_ids')
    def _compute_indicators_general(self):
        """
        Calcula indicadores generales (todos los sitios y servicios).
        Suma global de toda la cotización.
        """
        for rec in self:
            # Total de elementos = todas las líneas de la cotización
            total_elementos = len(rec.line_ids)

            # Costo mensual total = suma de todos los total_price
            costo_mensual = sum(rec.line_ids.mapped('total_price'))

            # Personal requerido = suma de quantity en todas las líneas de mano_obra
            mo_lines = rec.line_ids.filtered(lambda l: l.rubro_code == 'mano_obra')
            personal_requerido = int(sum(mo_lines.mapped('quantity')))

            # Porcentaje de completitud (estimación basada en rubros con líneas)
            # TODO: Mejorar esta métrica según criterios de negocio
            # Por ahora: calculamos cuántos rubros tienen líneas vs total esperado
            rubros_con_datos = len(set(rec.line_ids.mapped('rubro_code')))
            total_rubros_esperados = 14  # Total de rubros definidos en RUBRO_CODES
            pct_completado = (rubros_con_datos / total_rubros_esperados * 100.0) if total_rubros_esperados > 0 else 0.0

            # Asignar valores
            rec.indicator_general_total_elementos = total_elementos
            rec.indicator_general_costo_mensual = costo_mensual
            rec.indicator_general_personal_requerido = personal_requerido
            rec.indicator_general_pct_completado = pct_completado

    @api.depends('line_ids', 'line_ids.total_price', 'current_site_id', 'utility_percent', 'admin_percent',
                 'transporte_rate', 'bienestar_rate', 'financial_percent')
    def _compute_indicators_sitio(self):
        """
        Calcula indicadores del sitio actual (tabla Resumen del Sitio).
        Suma TODOS los servicios del sitio actual.

        Fórmulas:
        SUBTOTAL 1 = Mano Obra + Uniformes + EPP + EPP Alturas + Equipo Especial +
                     Comunicación + Herramienta Menor + Material Limpieza
        Administración = SUBTOTAL 1 × (admin_percent / 100)
        Utilidad = SUBTOTAL 1 × (utility_percent / 100)
        SUBTOTAL 2 = SUBTOTAL 1 + Administración + Utilidad
        Transporte = tarifa_transporte × total_colaboradores
        Bienestar = tarifa_bienestar × total_colaboradores
        Costo Financiero = (SUBTOTAL 1 + Perfil Médico + Maquinaria Limpieza +
                           Fertilizantes + Consumibles + Transporte + Capacitación) × (financial_percent / 100)
        TOTAL ANTES IVA = SUBTOTAL 2 + Perfil Médico + Maquinaria Limpieza + Maquinaria Jardinería +
                         Fertilizantes + Consumibles + Transporte + Bienestar + Capacitación + Costo Financiero
        """
        for rec in self:
            if not rec.current_site_id:
                # Sin sitio, poner todo en 0
                rec.indicator_sitio_mano_obra = 0.0
                rec.indicator_sitio_uniformes = 0.0
                rec.indicator_sitio_epp = 0.0
                rec.indicator_sitio_epp_alturas = 0.0
                rec.indicator_sitio_equipo_especial = 0.0
                rec.indicator_sitio_comunicacion = 0.0
                rec.indicator_sitio_herramienta = 0.0
                rec.indicator_sitio_material_limpieza = 0.0
                rec.indicator_sitio_otros_rubros = 0.0
                rec.indicator_sitio_subtotal_1 = 0.0
                rec.indicator_sitio_administracion = 0.0
                rec.indicator_sitio_administracion_pct = 0.0
                rec.indicator_sitio_utilidad = 0.0
                rec.indicator_sitio_utilidad_pct = 0.0
                rec.indicator_sitio_subtotal_2 = 0.0
                rec.indicator_sitio_perfil_medico = 0.0
                rec.indicator_sitio_maquinaria_limpieza = 0.0
                rec.indicator_sitio_maquinaria_jardineria = 0.0
                rec.indicator_sitio_fertilizantes = 0.0
                rec.indicator_sitio_consumibles = 0.0
                rec.indicator_sitio_transporte = 0.0
                rec.indicator_sitio_bienestar = 0.0
                rec.indicator_sitio_capacitacion = 0.0
                rec.indicator_sitio_costo_financiero = 0.0
                rec.indicator_sitio_costo_financiero_pct = 0.0
                rec.indicator_sitio_total_mensual_antes_iva = 0.0
                rec.indicator_sitio_iva = 0.0
                rec.indicator_sitio_total_mensual_con_iva = 0.0
                # PP values
                rec.indicator_sitio_mano_obra_pp = 0.0
                rec.indicator_sitio_uniformes_pp = 0.0
                rec.indicator_sitio_epp_pp = 0.0
                rec.indicator_sitio_epp_alturas_pp = 0.0
                rec.indicator_sitio_equipo_especial_pp = 0.0
                rec.indicator_sitio_comunicacion_pp = 0.0
                rec.indicator_sitio_herramienta_pp = 0.0
                rec.indicator_sitio_material_limpieza_pp = 0.0
                rec.indicator_sitio_otros_rubros_pp = 0.0
                rec.indicator_sitio_subtotal_1_pp = 0.0
                rec.indicator_sitio_administracion_pp = 0.0
                rec.indicator_sitio_utilidad_pp = 0.0
                rec.indicator_sitio_subtotal_2_pp = 0.0
                rec.indicator_sitio_perfil_medico_pp = 0.0
                rec.indicator_sitio_maquinaria_limpieza_pp = 0.0
                rec.indicator_sitio_maquinaria_jardineria_pp = 0.0
                rec.indicator_sitio_fertilizantes_pp = 0.0
                rec.indicator_sitio_consumibles_pp = 0.0
                rec.indicator_sitio_transporte_pp = 0.0
                rec.indicator_sitio_bienestar_pp = 0.0
                rec.indicator_sitio_capacitacion_pp = 0.0
                rec.indicator_sitio_costo_financiero_pp = 0.0
                rec.indicator_sitio_total_mensual_antes_iva_pp = 0.0
                # Legacy
                rec.indicator_sitio_total_elementos = 0
                rec.indicator_sitio_inversion_inicial = 0.0
                rec.indicator_sitio_costo_mensual = 0.0
                rec.indicator_sitio_personal_total = 0
                continue

            # Filtrar líneas por sitio actual (todos los servicios)
            lines = rec.line_ids.filtered(lambda l: l.site_id == rec.current_site_id)

            # Calcular total de colaboradores (suma de quantity en todas las líneas de mano_obra)
            mo_lines = lines.filtered(lambda l: l.rubro_code == 'mano_obra')
            total_colaboradores = int(sum(mo_lines.mapped('quantity')))

            # Helper para sumar por rubro
            def sum_by_rubro(rubro_code):
                return sum(lines.filtered(lambda l: l.rubro_code == rubro_code).mapped('total_price'))

            # Calcular rubros individuales
            mano_obra = sum_by_rubro('mano_obra')
            uniformes = sum_by_rubro('uniforme')
            epp = sum_by_rubro('epp')
            epp_alturas = sum_by_rubro('epp_alturas')
            equipo_especial = sum_by_rubro('equipo_especial_limpieza')
            comunicacion = sum_by_rubro('comunicacion_computo')
            herramienta = sum_by_rubro('herramienta_menor_jardineria')
            material_limpieza = sum_by_rubro('material_limpieza')
            perfil_medico = sum_by_rubro('perfil_medico')
            maquinaria_limpieza = sum_by_rubro('maquinaria_limpieza')
            maquinaria_jardineria = sum_by_rubro('maquinaria_jardineria')
            fertilizantes = sum_by_rubro('fertilizantes_tierra_lama')
            consumibles = sum_by_rubro('consumibles_jardineria')
            capacitacion = sum_by_rubro('capacitacion')

            # SUBTOTAL 1 (según fórmula proporcionada)
            subtotal_1 = (mano_obra + uniformes + epp + epp_alturas + equipo_especial +
                         comunicacion + herramienta + material_limpieza)

            # Porcentajes configurables
            admin_pct = rec.admin_percent or 0.0
            utilidad_pct = rec.utility_percent or 0.0
            costo_financiero_pct = rec.financial_percent or 0.0

            # Administración y Utilidad sobre SUBTOTAL 1
            administracion = subtotal_1 * (admin_pct / 100.0)
            utilidad = subtotal_1 * (utilidad_pct / 100.0)

            # SUBTOTAL 2
            subtotal_2 = subtotal_1 + administracion + utilidad

            # Transporte y Bienestar (basados en tarifas por colaborador)
            tarifa_transporte = rec.transporte_rate or 0.0
            tarifa_bienestar = rec.bienestar_rate or 0.0
            transporte = tarifa_transporte * total_colaboradores
            bienestar = tarifa_bienestar * total_colaboradores

            # Costo Financiero (según fórmula proporcionada)
            base_costo_financiero = (subtotal_1 + perfil_medico + maquinaria_limpieza +
                                    fertilizantes + consumibles + transporte + capacitacion)
            costo_financiero = base_costo_financiero * (costo_financiero_pct / 100.0)

            # TOTAL MENSUAL ANTES DE IVA (según fórmula proporcionada)
            total_mensual_antes_iva = (subtotal_2 + perfil_medico + maquinaria_limpieza +
                                      maquinaria_jardineria + fertilizantes + consumibles +
                                      transporte + bienestar + capacitacion + costo_financiero)

            # IVA (16% sobre total antes de IVA)
            iva = total_mensual_antes_iva * 0.16

            # TOTAL MENSUAL CON IVA
            total_mensual_con_iva = total_mensual_antes_iva + iva

            # Asignar valores totales
            rec.indicator_sitio_mano_obra = mano_obra
            rec.indicator_sitio_uniformes = uniformes
            rec.indicator_sitio_epp = epp
            rec.indicator_sitio_epp_alturas = epp_alturas
            rec.indicator_sitio_equipo_especial = equipo_especial
            rec.indicator_sitio_comunicacion = comunicacion
            rec.indicator_sitio_herramienta = herramienta
            rec.indicator_sitio_material_limpieza = material_limpieza
            rec.indicator_sitio_otros_rubros = epp_alturas + equipo_especial + comunicacion + herramienta + material_limpieza
            rec.indicator_sitio_subtotal_1 = subtotal_1
            rec.indicator_sitio_administracion = administracion
            rec.indicator_sitio_administracion_pct = admin_pct
            rec.indicator_sitio_utilidad = utilidad
            rec.indicator_sitio_utilidad_pct = utilidad_pct
            rec.indicator_sitio_subtotal_2 = subtotal_2
            rec.indicator_sitio_perfil_medico = perfil_medico
            rec.indicator_sitio_maquinaria_limpieza = maquinaria_limpieza
            rec.indicator_sitio_maquinaria_jardineria = maquinaria_jardineria
            rec.indicator_sitio_fertilizantes = fertilizantes
            rec.indicator_sitio_consumibles = consumibles
            rec.indicator_sitio_transporte = transporte
            rec.indicator_sitio_bienestar = bienestar
            rec.indicator_sitio_capacitacion = capacitacion
            rec.indicator_sitio_costo_financiero = costo_financiero
            rec.indicator_sitio_costo_financiero_pct = costo_financiero_pct
            rec.indicator_sitio_total_mensual_antes_iva = total_mensual_antes_iva
            rec.indicator_sitio_iva = iva
            rec.indicator_sitio_total_mensual_con_iva = total_mensual_con_iva

            # Calcular valores por persona (Per Person)
            if total_colaboradores > 0:
                rec.indicator_sitio_mano_obra_pp = mano_obra / total_colaboradores
                rec.indicator_sitio_uniformes_pp = uniformes / total_colaboradores
                rec.indicator_sitio_epp_pp = epp / total_colaboradores
                rec.indicator_sitio_epp_alturas_pp = epp_alturas / total_colaboradores
                rec.indicator_sitio_equipo_especial_pp = equipo_especial / total_colaboradores
                rec.indicator_sitio_comunicacion_pp = comunicacion / total_colaboradores
                rec.indicator_sitio_herramienta_pp = herramienta / total_colaboradores
                rec.indicator_sitio_material_limpieza_pp = material_limpieza / total_colaboradores
                rec.indicator_sitio_otros_rubros_pp = rec.indicator_sitio_otros_rubros / total_colaboradores
                rec.indicator_sitio_subtotal_1_pp = subtotal_1 / total_colaboradores
                rec.indicator_sitio_administracion_pp = administracion / total_colaboradores
                rec.indicator_sitio_utilidad_pp = utilidad / total_colaboradores
                rec.indicator_sitio_subtotal_2_pp = subtotal_2 / total_colaboradores
                rec.indicator_sitio_perfil_medico_pp = perfil_medico / total_colaboradores
                rec.indicator_sitio_maquinaria_limpieza_pp = maquinaria_limpieza / total_colaboradores
                rec.indicator_sitio_maquinaria_jardineria_pp = maquinaria_jardineria / total_colaboradores
                rec.indicator_sitio_fertilizantes_pp = fertilizantes / total_colaboradores
                rec.indicator_sitio_consumibles_pp = consumibles / total_colaboradores
                rec.indicator_sitio_transporte_pp = transporte / total_colaboradores
                rec.indicator_sitio_bienestar_pp = bienestar / total_colaboradores
                rec.indicator_sitio_capacitacion_pp = capacitacion / total_colaboradores
                rec.indicator_sitio_costo_financiero_pp = costo_financiero / total_colaboradores
                rec.indicator_sitio_total_mensual_antes_iva_pp = total_mensual_antes_iva / total_colaboradores
            else:
                rec.indicator_sitio_mano_obra_pp = 0.0
                rec.indicator_sitio_uniformes_pp = 0.0
                rec.indicator_sitio_epp_pp = 0.0
                rec.indicator_sitio_epp_alturas_pp = 0.0
                rec.indicator_sitio_equipo_especial_pp = 0.0
                rec.indicator_sitio_comunicacion_pp = 0.0
                rec.indicator_sitio_herramienta_pp = 0.0
                rec.indicator_sitio_material_limpieza_pp = 0.0
                rec.indicator_sitio_otros_rubros_pp = 0.0
                rec.indicator_sitio_subtotal_1_pp = 0.0
                rec.indicator_sitio_administracion_pp = 0.0
                rec.indicator_sitio_utilidad_pp = 0.0
                rec.indicator_sitio_subtotal_2_pp = 0.0
                rec.indicator_sitio_perfil_medico_pp = 0.0
                rec.indicator_sitio_maquinaria_limpieza_pp = 0.0
                rec.indicator_sitio_maquinaria_jardineria_pp = 0.0
                rec.indicator_sitio_fertilizantes_pp = 0.0
                rec.indicator_sitio_consumibles_pp = 0.0
                rec.indicator_sitio_transporte_pp = 0.0
                rec.indicator_sitio_bienestar_pp = 0.0
                rec.indicator_sitio_capacitacion_pp = 0.0
                rec.indicator_sitio_costo_financiero_pp = 0.0
                rec.indicator_sitio_total_mensual_antes_iva_pp = 0.0

            # Valores legacy (mantener compatibilidad)
            rec.indicator_sitio_total_elementos = len(lines)
            rec.indicator_sitio_inversion_inicial = 0.0  # TODO: calcular inversión inicial si aplica
            rec.indicator_sitio_costo_mensual = total_mensual_antes_iva
            rec.indicator_sitio_personal_total = total_colaboradores

    @api.depends('line_ids', 'line_ids.total_price', 'line_ids.monthly_subtotal', 'line_ids.mo_prestaciones',
                 'current_site_id', 'current_service_type', 'prestaciones_percent')
    def _compute_indicators_servicio(self):
        """
        Calcula indicadores del servicio actual en el sitio actual.
        Filtrar line_ids por current_site_id y current_service_type y calcular valores reales.
        """
        for rec in self:
            if not rec.current_site_id or not rec.current_service_type:
                # Sin contexto, poner todo en 0
                rec.indicator_servicio_total_colaboradores = 0
                rec.indicator_servicio_pct_prestaciones = 0.0
                rec.indicator_servicio_sueldo_bruto = 0.0
                rec.indicator_servicio_sueldo_bruto_pp = 0.0
                rec.indicator_servicio_prestaciones = 0.0
                rec.indicator_servicio_prestaciones_pp = 0.0
                rec.indicator_servicio_mano_obra = 0.0
                rec.indicator_servicio_mano_obra_pp = 0.0
                rec.indicator_servicio_uniformes = 0.0
                rec.indicator_servicio_uniformes_pp = 0.0
                rec.indicator_servicio_epp = 0.0
                rec.indicator_servicio_epp_pp = 0.0
                rec.indicator_servicio_epp_alturas = 0.0
                rec.indicator_servicio_epp_alturas_pp = 0.0
                rec.indicator_servicio_comunicacion = 0.0
                rec.indicator_servicio_comunicacion_pp = 0.0
                rec.indicator_servicio_herramienta = 0.0
                rec.indicator_servicio_herramienta_pp = 0.0
                rec.indicator_servicio_perfil_medico = 0.0
                rec.indicator_servicio_perfil_medico_pp = 0.0
                rec.indicator_servicio_maquinaria = 0.0
                rec.indicator_servicio_maquinaria_pp = 0.0
                rec.indicator_servicio_fertilizantes = 0.0
                rec.indicator_servicio_fertilizantes_pp = 0.0
                rec.indicator_servicio_consumibles = 0.0
                rec.indicator_servicio_consumibles_pp = 0.0
                rec.indicator_servicio_capacitacion = 0.0
                rec.indicator_servicio_capacitacion_pp = 0.0
                rec.indicator_servicio_material_limpieza = 0.0
                rec.indicator_servicio_material_limpieza_pp = 0.0
                rec.indicator_servicio_maquinaria_limpieza = 0.0
                rec.indicator_servicio_maquinaria_limpieza_pp = 0.0
                rec.indicator_servicio_equipo_especial = 0.0
                rec.indicator_servicio_equipo_especial_pp = 0.0
                rec.indicator_servicio_total = 0.0
                rec.indicator_servicio_total_pp = 0.0
                continue

            # Filtrar líneas por sitio y servicio actual
            lines = rec.line_ids.filtered(
                lambda l: l.site_id == rec.current_site_id and l.service_type == rec.current_service_type
            )

            # Calcular colaboradores (suma de quantity en líneas de mano_obra)
            mo_lines = lines.filtered(lambda l: l.rubro_code == 'mano_obra')
            total_colaboradores = int(sum(mo_lines.mapped('quantity')))

            # Porcentaje de prestaciones
            pct_prestaciones = rec.prestaciones_percent or 0.0

            # Helper para sumar por rubro
            def sum_by_rubro(rubro_code):
                return sum(lines.filtered(lambda l: l.rubro_code == rubro_code).mapped('total_price'))

            # Calcular mano de obra (total_price ya incluye prestaciones)
            mano_obra = sum_by_rubro('mano_obra')

            # Calcular sueldo bruto y prestaciones por separado para mostrar el desglose
            sueldo_bruto = sum(mo_lines.mapped('monthly_subtotal'))  # Subtotal sin prestaciones
            prestaciones = sum(mo_lines.mapped('mo_prestaciones'))   # Prestaciones calculadas

            # Calcular totales por rubro
            uniformes = sum_by_rubro('uniforme')
            epp = sum_by_rubro('epp')
            epp_alturas = sum_by_rubro('epp_alturas')
            comunicacion = sum_by_rubro('comunicacion_computo')
            herramienta = sum_by_rubro('herramienta_menor_jardineria')
            perfil_medico = sum_by_rubro('perfil_medico')
            maquinaria = sum_by_rubro('maquinaria_jardineria')
            fertilizantes = sum_by_rubro('fertilizantes_tierra_lama')
            consumibles = sum_by_rubro('consumibles_jardineria')
            capacitacion = sum_by_rubro('capacitacion')
            material_limpieza = sum_by_rubro('material_limpieza')
            maquinaria_limpieza = sum_by_rubro('maquinaria_limpieza')
            equipo_especial = sum_by_rubro('equipo_especial_limpieza')

            # Asignar valores
            rec.indicator_servicio_total_colaboradores = total_colaboradores
            rec.indicator_servicio_pct_prestaciones = pct_prestaciones

            rec.indicator_servicio_sueldo_bruto = sueldo_bruto
            rec.indicator_servicio_prestaciones = prestaciones
            rec.indicator_servicio_mano_obra = mano_obra

            rec.indicator_servicio_uniformes = uniformes
            rec.indicator_servicio_epp = epp
            rec.indicator_servicio_epp_alturas = epp_alturas
            rec.indicator_servicio_comunicacion = comunicacion
            rec.indicator_servicio_herramienta = herramienta
            rec.indicator_servicio_perfil_medico = perfil_medico
            rec.indicator_servicio_maquinaria = maquinaria
            rec.indicator_servicio_fertilizantes = fertilizantes
            rec.indicator_servicio_consumibles = consumibles
            rec.indicator_servicio_capacitacion = capacitacion
            rec.indicator_servicio_material_limpieza = material_limpieza
            rec.indicator_servicio_maquinaria_limpieza = maquinaria_limpieza
            rec.indicator_servicio_equipo_especial = equipo_especial

            # Calcular totales por persona
            if total_colaboradores > 0:
                rec.indicator_servicio_sueldo_bruto_pp = sueldo_bruto / total_colaboradores
                rec.indicator_servicio_prestaciones_pp = prestaciones / total_colaboradores
                rec.indicator_servicio_mano_obra_pp = mano_obra / total_colaboradores
                rec.indicator_servicio_uniformes_pp = uniformes / total_colaboradores
                rec.indicator_servicio_epp_pp = epp / total_colaboradores
                rec.indicator_servicio_epp_alturas_pp = epp_alturas / total_colaboradores
                rec.indicator_servicio_comunicacion_pp = comunicacion / total_colaboradores
                rec.indicator_servicio_herramienta_pp = herramienta / total_colaboradores
                rec.indicator_servicio_perfil_medico_pp = perfil_medico / total_colaboradores
                rec.indicator_servicio_maquinaria_pp = maquinaria / total_colaboradores
                rec.indicator_servicio_fertilizantes_pp = fertilizantes / total_colaboradores
                rec.indicator_servicio_consumibles_pp = consumibles / total_colaboradores
                rec.indicator_servicio_capacitacion_pp = capacitacion / total_colaboradores
                rec.indicator_servicio_material_limpieza_pp = material_limpieza / total_colaboradores
                rec.indicator_servicio_maquinaria_limpieza_pp = maquinaria_limpieza / total_colaboradores
                rec.indicator_servicio_equipo_especial_pp = equipo_especial / total_colaboradores
            else:
                rec.indicator_servicio_sueldo_bruto_pp = 0.0
                rec.indicator_servicio_prestaciones_pp = 0.0
                rec.indicator_servicio_mano_obra_pp = 0.0
                rec.indicator_servicio_uniformes_pp = 0.0
                rec.indicator_servicio_epp_pp = 0.0
                rec.indicator_servicio_epp_alturas_pp = 0.0
                rec.indicator_servicio_comunicacion_pp = 0.0
                rec.indicator_servicio_herramienta_pp = 0.0
                rec.indicator_servicio_perfil_medico_pp = 0.0
                rec.indicator_servicio_maquinaria_pp = 0.0
                rec.indicator_servicio_fertilizantes_pp = 0.0
                rec.indicator_servicio_consumibles_pp = 0.0
                rec.indicator_servicio_capacitacion_pp = 0.0
                rec.indicator_servicio_material_limpieza_pp = 0.0
                rec.indicator_servicio_maquinaria_limpieza_pp = 0.0
                rec.indicator_servicio_equipo_especial_pp = 0.0

            # Total del servicio (suma de todos los rubros)
            total = (mano_obra + uniformes + epp + epp_alturas + comunicacion + herramienta +
                    perfil_medico + maquinaria + fertilizantes + consumibles + capacitacion +
                    material_limpieza + maquinaria_limpieza + equipo_especial)

            rec.indicator_servicio_total = total
            rec.indicator_servicio_total_pp = total / total_colaboradores if total_colaboradores > 0 else 0.0

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
        """Genera un PDF con el resumen general de la cotización"""
        self.ensure_one()
        return self.env.ref('ccn_service_quote.report_general_summary_pdf').report_action(self)
