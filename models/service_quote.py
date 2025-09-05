# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuote(models.Model):
    _name = "ccn.service.quote"
    _description = "CCN Service Quote"
    _order = "id desc"

    name = fields.Char(string="Nombre", default="Nueva cotización", required=True)
    partner_id = fields.Many2one("res.partner", string="Cliente")

    # NUEVO: etiqueta de sitio (para la sección de primer nivel)
    site_label = fields.Char(string="Sitio", help="Ej.: AEROPUERTO")

    category = fields.Selection(
        [("garden", "Jardinería"), ("clean", "Limpieza")],
        required=True, default="garden", string="Categoría"
    )
    display_mode = fields.Selection(
        [("itemized", "Itemizado"),
         ("by_rubro", "Acumulado por rubro"),
         ("total_only", "Acumulado total")],
        required=True, default="itemized", string="Modo de presentación"
    )

    # Rubros internos (aún sin cálculo global)
    admin_percent = fields.Float(string="% Administración", digits=(5, 2), default=0.0)
    utility_percent = fields.Float(string="% Utilidad", digits=(5, 2), default=0.0)
    financial_percent = fields.Float(string="% Costo financiero", digits=(5, 2), default=0.0)

    note_text = fields.Text("Nota (se mostrará como Sección en la SO)")
    line_ids = fields.One2many("ccn.service.quote.line", "quote_id", string="Líneas")

    currency_id = fields.Many2one(
        "res.currency",
        default=lambda self: self.env.company.currency_id,  # en lugar de .id
    )

    amount_untaxed = fields.Monetary(
        compute="_compute_amounts", currency_field="currency_id", store=True, string="Subtotal"
    )

    site_ids = fields.One2many(
        "ccn.service.quote.site",  # comodel
        "quote_id",                # inverso en el comodel
        string="Sitios",
    )

    @api.depends("line_ids.total_price")
    def _compute_amounts(self):
        for q in self:
            q.amount_untaxed = sum(q.mapped("line_ids.total_price"))
