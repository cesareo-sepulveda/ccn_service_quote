# -*- coding: utf-8 -*-
from odoo import models, fields

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    # Tags de Rubro usados para filtrar en CCN Service Quote
    ccn_rubro_ids = fields.Many2many(
        'ccn.service.rubro',
        'ccn_rubro_product_rel',
        'product_tmpl_id',
        'rubro_id',
        string='Rubros CCN',
        help='Rubros CCN a los que pertenece este producto/servicio.'
    )

    # Ocultar este producto del selector en CCN Service Quote (para “contenedores”)
    ccn_exclude_from_quote = fields.Boolean(
        string='Ocultar en CCN Service Quote',
        default=False,
        help='Si está activo, este producto no aparece al elegir productos en CCN Service Quote.'
    )
