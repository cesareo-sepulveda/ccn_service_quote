# -*- coding: utf-8 -*-
from odoo import api, fields, models
from markupsafe import Markup

class GeneralSummaryWizard(models.TransientModel):
    _name = 'ccn.general.summary.wizard'
    _description = 'Resumen General de la Cotización'

    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True)
    currency_id = fields.Many2one(related='quote_id.currency_id', readonly=True)

    # Tabla HTML renderizada dinámicamente
    summary_table_html = fields.Html(
        string='Tabla de Resumen',
        compute='_compute_summary_table_html',
        sanitize=False
    )

    @api.depends('quote_id', 'quote_id.site_ids', 'quote_id.line_ids', 'quote_id.utility_percent',
                 'quote_id.admin_percent', 'quote_id.transporte_rate', 'quote_id.bienestar_rate',
                 'quote_id.financial_percent')
    def _compute_summary_table_html(self):
        """
        Genera la tabla HTML del resumen general con columnas dinámicas por sitio.
        Usa la misma lógica de cálculo que _compute_indicators_sitio().
        """
        for rec in self:
            if not rec.quote_id:
                rec.summary_table_html = '<p>No hay cotización seleccionada</p>'
                continue

            quote = rec.quote_id

            # Obtener sitios activos (excluyendo "General")
            sites = quote.site_ids.filtered(
                lambda s: s.active and (s.name or '').strip().lower() != 'general'
            ).sorted(key=lambda s: s.sequence)

            if not sites:
                rec.summary_table_html = '<p>No hay sitios configurados</p>'
                continue

            # Símbolo de moneda
            currency_symbol = rec.currency_id.symbol or '$'

            # Porcentajes configurables
            admin_pct = quote.admin_percent or 0.0
            utilidad_pct = quote.utility_percent or 0.0
            costo_financiero_pct = quote.financial_percent or 0.0
            tarifa_transporte = quote.transporte_rate or 0.0
            tarifa_bienestar = quote.bienestar_rate or 0.0

            # Calcular valores por sitio
            site_data = {}
            for site in sites:
                lines = quote.line_ids.filtered(lambda l: l.site_id == site)
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

                # SUBTOTAL 1
                subtotal_1 = (mano_obra + uniformes + epp + epp_alturas + equipo_especial +
                             comunicacion + herramienta + material_limpieza)

                # Administración y Utilidad
                administracion = subtotal_1 * (admin_pct / 100.0)
                utilidad = subtotal_1 * (utilidad_pct / 100.0)

                # SUBTOTAL 2
                subtotal_2 = subtotal_1 + administracion + utilidad

                # Transporte y Bienestar
                transporte = tarifa_transporte * total_colaboradores
                bienestar = tarifa_bienestar * total_colaboradores

                # Costo Financiero
                base_costo_financiero = (subtotal_1 + perfil_medico + maquinaria_limpieza +
                                        fertilizantes + consumibles + transporte + capacitacion)
                costo_financiero = base_costo_financiero * (costo_financiero_pct / 100.0)

                # TOTAL MENSUAL ANTES DE IVA
                total_mensual_antes_iva = (subtotal_2 + perfil_medico + maquinaria_limpieza +
                                          maquinaria_jardineria + fertilizantes + consumibles +
                                          transporte + bienestar + capacitacion + costo_financiero)

                # IVA y TOTAL CON IVA
                iva = total_mensual_antes_iva * 0.16
                total_mensual_con_iva = total_mensual_antes_iva + iva

                # Guardar datos del sitio
                site_data[site.id] = {
                    'mano_obra': mano_obra,
                    'uniformes': uniformes,
                    'epp': epp,
                    'epp_alturas': epp_alturas,
                    'equipo_especial': equipo_especial,
                    'comunicacion': comunicacion,
                    'herramienta': herramienta,
                    'material_limpieza': material_limpieza,
                    'subtotal_1': subtotal_1,
                    'administracion': administracion,
                    'utilidad': utilidad,
                    'subtotal_2': subtotal_2,
                    'perfil_medico': perfil_medico,
                    'maquinaria_limpieza': maquinaria_limpieza,
                    'maquinaria_jardineria': maquinaria_jardineria,
                    'fertilizantes': fertilizantes,
                    'consumibles': consumibles,
                    'transporte': transporte,
                    'bienestar': bienestar,
                    'capacitacion': capacitacion,
                    'costo_financiero': costo_financiero,
                    'total_mensual_antes_iva': total_mensual_antes_iva,
                    'iva': iva,
                    'total_mensual_con_iva': total_mensual_con_iva,
                }

            # Generar HTML
            html = ['<table class="table table-sm table-bordered table-hover" style="width: 100%;">']

            # Encabezado
            html.append('<thead class="table-light"><tr>')
            html.append('<th style="text-align: left; background-color: #4CAF50; color: white;">DESCRIPCIÓN</th>')
            for site in sites:
                html.append(f'<th style="text-align: right; background-color: #4CAF50; color: white;">{site.name.upper()}</th>')
            html.append('<th style="text-align: right; background-color: #2E7D32; color: white;">TOTAL</th>')
            html.append('</tr></thead>')

            # Cuerpo
            html.append('<tbody>')

            # Helper para agregar fila
            def add_row(label, field_name, bold=False, css_class=''):
                row_class = f' class="{css_class}"' if css_class else ''
                html.append(f'<tr{row_class}>')
                tag = 'strong' if bold else 'span'
                html.append(f'<td><{tag}>{label}</{tag}></td>')

                total = 0
                for site in sites:
                    value = site_data[site.id][field_name]
                    total += value
                    html.append(f'<td style="text-align: right;"><{tag}>{currency_symbol} {value:,.2f}</{tag}></td>')

                html.append(f'<td style="text-align: right;"><{tag}>{currency_symbol} {total:,.2f}</{tag}></td>')
                html.append('</tr>')

            # Rubros que componen SUBTOTAL 1
            add_row('Mano de Obra', 'mano_obra')
            add_row('Uniformes', 'uniformes')
            add_row('EPP', 'epp')
            add_row('EPP Alturas', 'epp_alturas')
            add_row('Equipo Especial de Limpieza', 'equipo_especial')
            add_row('Comunicación y Cómputo', 'comunicacion')
            add_row('Herramienta Menor Jardinería', 'herramienta')
            add_row('Material de Limpieza', 'material_limpieza')

            # SUBTOTAL 1
            add_row('SUBTOTAL 1', 'subtotal_1', bold=True, css_class='table-secondary')

            # Administración y Utilidad
            add_row(f'Administración {admin_pct:.2f}%', 'administracion')
            add_row(f'Utilidad {utilidad_pct:.2f}%', 'utilidad')

            # SUBTOTAL 2
            add_row('SUBTOTAL 2', 'subtotal_2', bold=True, css_class='table-info')

            # Rubros adicionales
            add_row('Perfil Médico', 'perfil_medico')
            add_row('Maquinaria de Limpieza', 'maquinaria_limpieza')
            add_row('Maquinaria de Jardinería', 'maquinaria_jardineria')
            add_row('Fertilizantes y Tierra Lama', 'fertilizantes')
            add_row('Consumibles de Jardinería', 'consumibles')
            add_row('Transporte', 'transporte')
            add_row('Bienestar', 'bienestar')
            add_row('Capacitación', 'capacitacion')
            add_row(f'Costo Financiero {costo_financiero_pct:.2f}%', 'costo_financiero')

            # TOTAL MENSUAL ANTES DE IVA
            add_row('TOTAL MENSUAL ANTES DE I.V.A.', 'total_mensual_antes_iva', bold=True, css_class='table-warning')

            # IVA
            add_row('I.V.A. (16%)', 'iva')

            # TOTAL CON IVA
            add_row('TOTAL MENSUAL CON I.V.A.', 'total_mensual_con_iva', bold=True, css_class='table-primary')

            html.append('</tbody></table>')

            rec.summary_table_html = Markup(''.join(html))

    def action_generate_pdf(self):
        """Genera el PDF del resumen general"""
        self.ensure_one()
        return self.env.ref('ccn_service_quote.report_general_summary_pdf').report_action(self.quote_id)
