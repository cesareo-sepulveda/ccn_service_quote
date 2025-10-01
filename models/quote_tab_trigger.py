# -*- coding: utf-8 -*-
from time import time
from odoo import api, fields, models

class CCNServiceQuoteUITabTrigger(models.Model):
    _inherit = 'ccn.service.quote'

    # Campo "dummy" para forzar reevaluaciones de attrs/domains en la vista
    tab_update_trigger = fields.Integer(
        string='Tab Update Trigger',
        compute='_compute_tab_update_trigger',
        store=False,
        readonly=True,
        help='Campo técnico para refrescar lógicas de pestañas/colores en la vista.'
    )

    @api.depends('write_date')
    def _compute_tab_update_trigger(self):
        """
        Se recomputa en cada write del registro gracias a 'write_date'.
        Usamos un entero basado en epoch para garantizar que cambie y fuerce reevaluación de attrs.
        """
        now_int = int(time())
        for rec in self:
            rec.tab_update_trigger = now_int
