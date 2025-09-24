# -*- coding: utf-8 -*-
"""Extensiones del modelo de clientes para cotizaciones de servicio."""

from odoo import fields, models


class ResPartner(models.Model):
    """Relaciona a cada cliente con sus cotizaciones de servicio."""

    _inherit = "res.partner"

    service_quote_ids = fields.One2many(
        "ccn.service.quote",
        "partner_id",
        string="Cotizaciones de servicio",
    )
