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

    currency_id = fields.Many2one("res.currency", default=lambda self: self.env.company.currency_id.id)
    amount_untaxed = fields.Monetary(
        compute="_compute_amounts", currency_field="currency_id", store=True, string="Subtotal"
    )

    @api.depends("line_ids.total_price")
    def _compute_amounts(self):
        for q in self:
            q.amount_untaxed = sum(q.mapped("line_ids.total_price"))

class CCNServiceQuoteLine(models.Model):
    _name = "ccn.service.quote.line"
    _description = "Línea de CCN Service Quote"
    _order = "rubro_id, id"

    quote_id = fields.Many2one("ccn.service.quote", required=True, ondelete="cascade")
    rubro_id = fields.Many2one("ccn.service.rubro", string="Rubro", required=True)
    product_id = fields.Many2one("product.product", string="Producto/Servicio", required=True)

    quantity = fields.Float(string="Cantidad", default=1.0, required=True)
    base_price_unit = fields.Monetary(string="Precio base", currency_field="currency_id",
                                      help="Lista base del producto al cotizar")
    tabulator_percent = fields.Selection(
        [("0", "0%"), ("3", "3%"), ("5", "5%"), ("10", "10%")],
        string="Tabulador extra (%)", default="0",
        help="Porcentaje adicional aplicado a esta línea (oculto al cliente).",
    )
    price_unit_final = fields.Monetary(string="Precio con tabulador", currency_field="currency_id")
    total_price = fields.Monetary(string="Importe", compute="_compute_total",
                                  currency_field="currency_id", store=True)
    currency_id = fields.Many2one(related="quote_id.currency_id", store=True, readonly=True)

    @api.onchange("product_id")
    def _onchange_product_id(self):
        for l in self:
            if l.product_id:
                l.base_price_unit = l.product_id.lst_price
                l._recompute_final()

    @api.onchange("tabulator_percent", "base_price_unit")
    def _onchange_tab_or_base(self):
        for l in self:
            l._recompute_final()

    def _recompute_final(self):
        for l in self:
            perc = float(l.tabulator_percent or "0") / 100.0
            l.price_unit_final = (l.base_price_unit or 0.0) * (1.0 + perc)

    @api.depends("quantity", "price_unit_final")
    def _compute_total(self):
        for l in self:
            l.total_price = (l.price_unit_final or 0.0) * (l.quantity or 0.0)
