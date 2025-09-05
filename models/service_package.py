# -*- coding: utf-8 -*-
from odoo import models, fields

class CcnServicePackage(models.Model):
    _name = 'ccn.service.package'
    _description = 'CCN Service Package'

    name = fields.Char(string="Nombre del paquete", required=True)
    line_ids = fields.One2many(
        'ccn.service.package.line',
        'package_id',
        string="Líneas"
    )


class CcnServicePackageLine(models.Model):
    _name = 'ccn.service.package.line'
    _description = 'CCN Service Package Line'

    package_id = fields.Many2one(
        'ccn.service.package',
        string="Paquete",
        required=True,
        ondelete='cascade'
    )
    product_id = fields.Many2one(
        'product.product',
        string="Producto",
        required=True
    )
    quantity = fields.Float(string="Cantidad", default=1.0)
