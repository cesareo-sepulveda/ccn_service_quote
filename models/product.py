# -*- coding: utf-8 -*-
from odoo import models, fields

class ProductTemplate(models.Model):
    _inherit = "product.template"

    # Oculta “placeholders” en el selector del quote
    ccn_exclude_from_quote = fields.Boolean(
        string="Excluir del Cotizador",
        default=False,
        help="Si está activo, este producto no aparecerá en el selector del cotizador."
    )

    # Rubros permitidos para el cotizador (a nivel TEMPLATE)
    ccn_rubro_ids = fields.Many2many(
        "ccn.service.rubro",
        "ccn_rubro_product_rel",   # tabla rel
        "product_tmpl_id",         # columna FK a product.template
        "rubro_id",                # columna FK a ccn.service.rubro
        string="Rubros Cotizador"
    )
