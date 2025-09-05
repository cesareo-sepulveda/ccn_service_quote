# -*- coding: utf-8 -*-
from odoo import models, fields

class ProductTemplate(models.Model):
    _inherit = "product.template"

    ccn_rubro_ids = fields.Many2many(
        "ccn.rubro",
        "product_tmpl_rubro_rel",
        "product_tmpl_id",
        "rubro_id",
        string="Rubros (CCN)"
    )
    ccn_exclude_from_quote = fields.Boolean(
        string="Excluir de CCN Service Quote",
        help="Si está activo, este producto no aparecerá en el selector de líneas CCN."
    )
