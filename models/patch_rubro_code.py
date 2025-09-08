# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceQuoteLine(models.Model):
    _inherit = "ccn.service.quote.line"

    # Debe ser Selection porque ccn.service.rubro.code es Selection
    rubro_code = fields.Selection(
        related="rubro_id.code",
        store=True,
        readonly=True,
    )
