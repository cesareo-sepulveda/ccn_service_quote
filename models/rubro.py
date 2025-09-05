# -*- coding: utf-8 -*-
from odoo import fields, models

class CCNServiceRubro(models.Model):
    _name = "ccn.service.rubro"
    _description = "Rubro CCN"
    _order = "sequence, name"

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    internal_only = fields.Boolean(
        string="Solo interno",
        help="Si está marcado, este rubro NO debe mostrarse al cliente en la SO o reportes.",
        default=False,
    )
    active = fields.Boolean(default=True)
