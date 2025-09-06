# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuote(models.Model):
    _name = "ccn.service.quote"
    _description = "CCN Service Quote"
    _order = "id desc"

    # Cabecera
    name = fields.Char(string="Nombre", default="Nueva cotización", required=True)
    partner_id = fields.Many2one("res.partner", string="Cliente")

    # Etiqueta libre de sitio (Fase 1, se mantiene)
    site_label = fields.Char(string="Sitio", help="Ej.: AEROPUERTO")

    # Tipo general (solo para compatibilidad con Fase 1)
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

    # Parámetros globales (Fase 1)
    admin_percent = fields.Float(string="% Administración", digits=(5, 2), default=0.0)
    utility_percent = fields.Float(string="% Utilidad", digits=(5, 2), default=0.0)
    financial_percent = fields.Float(string="% Costo financiero", digits=(5, 2), default=0.0)

    note_text = fields.Text("Nota (se mostrará como Sección en la SO)")

    # Líneas legacy (Fase 1)
    line_ids = fields.One2many("ccn.service.quote.line", "quote_id", string="Líneas")

    # === FASE 2 ===
    # Sitios de la SQ y selector de sitio activo
    site_ids = fields.One2many("ccn.service.quote.site", "quote_id", string="Sitios")
    current_site_id = fields.Many2one(
        "ccn.service.quote.site",
        string="Sitio actual",
        domain="[('quote_id', '=', id)]",
        help="Selecciona el sitio que quieres editar. Las pestañas de abajo muestran los datos de este sitio."
    )

    # Totales (Fase 1)
    currency_id = fields.Many2one(
        "res.currency",
        default=lambda self: self.env.company.currency_id.id
    )
    amount_untaxed = fields.Monetary(
        compute="_compute_amounts",
        currency_field="currency_id",
        store=True,
        string="Subtotal"
    )

    @api.depends("line_ids.total_price")
    def _compute_amounts(self):
        for q in self:
            q.amount_untaxed = sum(q.mapped("line_ids.total_price"))

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        """Si no hay sitio seleccionado y existen sitios, toma el primero."""
        for q in self:
            if not q.current_site_id and q.site_ids:
                q.current_site_id = q.site_ids[0]
