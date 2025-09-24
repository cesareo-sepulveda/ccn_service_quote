# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceQuote(models.Model):
    _inherit = "ccn.service.quote"

    partner_id = fields.Many2one("res.partner", string="Cliente", required=True)
    user_id = fields.Many2one("res.users", string="Responsable")
