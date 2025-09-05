# -*- coding: utf-8 -*-
from odoo import models, fields, api

class CCNServiceQuoteLineTab(models.Model):
    _inherit = 'ccn.service.quote.line'

    # Selección de porcentaje extra por línea
    tabulador = fields.Selection(
        selection=[
            ('0',  '0%'),
            ('3',  '3%'),
            ('5',  '5%'),
            ('10', '10%'),
        ],
        string='Tabulador',
        default='0',
        help='Porcentaje extra aplicado sobre el precio base de esta línea.'
    )

    # Recalcula el precio final cuando cambia el tabulador o el base
    @api.onchange('tabulador', 'base_price_unit')
    def _onchange_tabulador_or_base(self):
        for rec in self:
            try:
                pct = float(rec.tabulador or '0') / 100.0
            except Exception:
                pct = 0.0
            if rec.base_price_unit is not None:
                rec.price_unit_final = rec.base_price_unit * (1.0 + pct)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            t_raw = vals.get('tabulador', '0') or '0'
            try:
                t = float(t_raw) / 100.0
            except Exception:
                t = 0.0
            if 'base_price_unit' in vals and 'price_unit_final' not in vals:
                base = vals.get('base_price_unit') or 0.0
                vals['price_unit_final'] = base * (1.0 + t)
        return super().create(vals_list)

    def write(self, vals):
        res = super().write(vals)
        # Si el usuario cambió tabulador o base (y no envió explícitamente price_unit_final),
        # recalculamos para mantener coherencia en servidor.
        if any(k in vals for k in ('tabulador', 'base_price_unit')) and 'price_unit_final' not in vals:
            for rec in self:
                try:
                    pct = float(rec.tabulador or '0') / 100.0
                except Exception:
                    pct = 0.0
                if rec.base_price_unit is not None:
                    rec.price_unit_final = rec.base_price_unit * (1.0 + pct)
        return res
