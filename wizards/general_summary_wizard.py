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

    @api.depends('quote_id', 'quote_id.site_ids', 'quote_id.line_ids')
    def _compute_summary_table_html(self):
        """
        Genera la tabla HTML del resumen general con columnas dinámicas por sitio.
        """
        for rec in self:
            if not rec.quote_id:
                rec.summary_table_html = '<p>No hay cotización seleccionada</p>'
                continue

            # Obtener sitios activos (excluyendo "General")
            sites = rec.quote_id.site_ids.filtered(
                lambda s: s.active and (s.name or '').strip().lower() != 'general'
            ).sorted(key=lambda s: s.sequence)

            if not sites:
                rec.summary_table_html = '<p>No hay sitios configurados</p>'
                continue

            # Símbolo de moneda
            currency_symbol = rec.currency_id.symbol or '$'

            # Datos dummy - TODO: calcular reales basados en line_ids
            # Estructura: cada rubro es una lista [sitio1, sitio2, ..., total]
            data = {
                'MANO DE OBRA': [877970.86, 204027.43, 1081998.29],
                'UNIFORMES': [1814.45, 2313.92, 4128.37],
                'EPP': [10705.33, 3313.92, 14019.25],
                'EPP ALTURAS': [2462.50, 1395.83, 3858.33],
                'EQUIPO ESPECIAL DE LIMPIEZA': [10729.33, 2481.33, 13210.67],
                'COMUNICACIÓN': [3991.67, 4400.00, 8391.67],
                'HRRTA MENOR JARDINERIA': [3771.03, 821.35, 4592.38],
                'CAPACITACIÓN': [59400.00, 12000.00, 71400.00],
            }

            subtotal = [989212.17, 228753.78, 1217965.95]
            coordinador = [117238.09, 26173.22, 143409.30]
            utilidad = [107468.41, 25035.25, 132501.66]

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

            # Rubros
            for rubro, valores in data.items():
                html.append('<tr>')
                html.append(f'<td>{rubro}</td>')
                for val in valores:
                    html.append(f'<td style="text-align: right;">{currency_symbol} {val:,.2f}</td>')
                html.append('</tr>')

            # Subtotal
            html.append('<tr class="table-secondary">')
            html.append('<td><strong>SUBTOTAL</strong></td>')
            for val in subtotal:
                html.append(f'<td style="text-align: right;"><strong>{currency_symbol} {val:,.2f}</strong></td>')
            html.append('</tr>')

            # Coordinador
            html.append('<tr>')
            html.append('<td>COORDINADOR 18%</td>')
            for val in coordinador:
                html.append(f'<td style="text-align: right;">{currency_symbol} {val:,.2f}</td>')
            html.append('</tr>')

            # Utilidad
            html.append('<tr>')
            html.append('<td>UTILIDAD</td>')
            for val in utilidad:
                html.append(f'<td style="text-align: right;">{currency_symbol} {val:,.2f}</td>')
            html.append('</tr>')

            # Total final
            total_final = [sum(x) for x in zip(subtotal, coordinador, utilidad)]
            html.append('<tr class="table-primary">')
            html.append('<td><strong>TOTAL MENSUAL ANTES DE I.V.A.</strong></td>')
            for val in total_final:
                html.append(f'<td style="text-align: right;"><strong>{currency_symbol} {val:,.2f}</strong></td>')
            html.append('</tr>')

            html.append('</tbody></table>')

            rec.summary_table_html = Markup(''.join(html))

    def action_generate_pdf(self):
        """Genera el PDF completo con todas las tablas"""
        self.ensure_one()
        return self.quote_id.action_generate_full_pdf()
