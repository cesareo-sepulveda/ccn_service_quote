# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuote(models.Model):
    _name = "ccn.service.quote"
    _description = "CCN Service Quote"
    _order = "id desc"

    # Identificación
    name = fields.Char(string="Nombre", default="Nueva cotización", required=True)
    partner_id = fields.Many2one("res.partner", string="Cliente")

    # Compat Fase 1
    site_label = fields.Char(string="Sitio", help="Etiqueta simple (compatibilidad Fase 1)")
    category = fields.Selection(
        [('garden', 'Jardinería'), ('clean', 'Limpieza')],
        string="Categoría",
        default='garden',
        required=True,
    )
    display_mode = fields.Selection(
        [('itemized', 'Itemizado'),
         ('by_rubro', 'Acumulado por rubro'),
         ('total_only', 'Acumulado total')],
        string="Modo de presentación",
        default='itemized',
        required=True,
    )

    # Parámetros globales (defaults)
    admin_percent = fields.Float(string="% Administración (global)", digits=(5, 2), default=0.0)
    utility_percent = fields.Float(string="% Utilidad (global)", digits=(5, 2), default=0.0)
    financial_percent = fields.Float(string="% Costo financiero (global)", digits=(5, 2), default=0.0)

    note_text = fields.Text("Nota (se mostrará como Sección en la SO)")

    # Líneas (Fase 1 / se filtran por sitio/tipo/rubro en la vista)
    line_ids = fields.One2many("ccn.service.quote.line", "quote_id", string="Líneas")

    # --- Fase 2: Sitios + selectores de contexto ---
    site_ids = fields.One2many("ccn.service.quote.site", "quote_id", string="Sitios")

    current_site_id = fields.Many2one(
        "ccn.service.quote.site",
        string="Sitio actual",
        domain="[('quote_id', '=', id)]",
        help="Selecciona el sitio que estás editando en las pestañas de rubros.",
    )

    current_type = fields.Selection(
        [('garden', 'Jardinería'), ('clean', 'Limpieza')],
        string="Tipo actual",
        default='garden',
        help="Selecciona el tipo que estás editando en las pestañas.",
    )

    # Moneda y subtotal (compatibilidad)
    currency_id = fields.Many2one(
        "res.currency",
        default=lambda self: self.env.company.currency_id.id
    )
    amount_untaxed = fields.Monetary(
        compute="_compute_amounts",
        currency_field="currency_id",
        store=False,
        string="Subtotal",
    )

    @api.depends("line_ids.total_price")
    def _compute_amounts(self):
        for q in self:
            q.amount_untaxed = sum(q.mapped("line_ids.total_price"))
