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

    # Relación con Rubros para filtrar productos por rubro en las líneas del quote
    ccn_rubro_ids = fields.Many2many(
        "ccn.service.rubro",
        "ccn_rubro_product_rel",
        "product_tmpl_id",
        "rubro_id",
        string="Rubros Cotizador"
    )
