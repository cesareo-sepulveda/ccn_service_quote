# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNRubroFlag(models.Model):
    _name = "ccn.service.rubro.flag"
    _description = "Reconocimiento de rubro vacío (por sitio y tipo)"
    _order = "id"

    quote_id = fields.Many2one("ccn.service.quote", required=True, ondelete="cascade")
    site_id = fields.Many2one("ccn.service.quote.site", required=True, ondelete="cascade")
    type = fields.Selection([("garden", "Jardinería"), ("clean", "Limpieza")], required=True)
    rubro_id = fields.Many2one("ccn.service.rubro", required=True, ondelete="cascade")
    ack_empty = fields.Boolean(string="Reconocido sin información", default=False)

    _sql_constraints = [
        ("uniq_flag", "unique(quote_id, site_id, type, rubro_id)",
         "Ya existe un reconocimiento para este rubro en el sitio/tipo."),
    ]
