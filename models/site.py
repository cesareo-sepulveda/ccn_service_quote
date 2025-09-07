# -*- coding: utf-8 -*-
from odoo import api, fields, models, _

class CCNServiceQuoteSite(models.Model):
    _name = "ccn.service.quote.site"
    _description = "Sitio de Service Quote"
    _order = "sequence, id"

    # Identificación y vínculo con la SQ
    name = fields.Char(string="Nombre del sitio", required=True)
    quote_id = fields.Many2one(
        "ccn.service.quote",
        string="Service Quote",
        required=True,
        ondelete="cascade",
    )
    sequence = fields.Integer(default=10)

    # Parámetros internos (por sitio)
    admin_percent = fields.Float(string="% Administración", digits=(5, 2), default=0.0)
    utility_percent = fields.Float(string="% Utilidad", digits=(5, 2), default=0.0)
    financial_percent = fields.Float(string="% Costo financiero", digits=(5, 2), default=0.0)

    # Parámetros especiales por sitio
    transporte_rate = fields.Float(string="Transporte (por headcount)", default=0.0)
    bienestar_rate = fields.Float(string="Bienestar (por headcount)", default=0.0)

    # Headcount del sitio (global o por tipo más adelante)
    headcount = fields.Float(string="Headcount", default=0.0)

    # Líneas del sitio (si aún no usas site_id en las líneas, puedes dejar este campo para más adelante)
    line_ids = fields.One2many(
        "ccn.service.quote.line",
        "site_id",
        string="Líneas",
        help="Líneas asociadas a este sitio (por tipo/rubro).",
    )

    # --- Placeholders de totales/resúmenes por sitio (se llenarán en Fase 2) ---
    subtotal1 = fields.Monetary(string="Subtotal 1", currency_field="currency_id", compute="_compute_totals", store=False)
    admin_amt = fields.Monetary(string="Administración", currency_field="currency_id", compute="_compute_totals", store=False)
    util_amt = fields.Monetary(string="Utilidad", currency_field="currency_id", compute="_compute_totals", store=False)
    subtotal2 = fields.Monetary(string="Subtotal 2", currency_field="currency_id", compute="_compute_totals", store=False)
    transporte_amt = fields.Monetary(string="Transporte", currency_field="currency_id", compute="_compute_totals", store=False)
    bienestar_amt = fields.Monetary(string="Bienestar", currency_field="currency_id", compute="_compute_totals", store=False)
    financial_amt = fields.Monetary(string="Costo financiero", currency_field="currency_id", compute="_compute_totals", store=False)
    total_monthly = fields.Monetary(string="Total mensual", currency_field="currency_id", compute="_compute_totals", store=False)

    currency_id = fields.Many2one(
        "res.currency",
        string="Moneda",
        default=lambda self: self.env.company.currency_id.id,
    )

    # -------------------------------------------------------------------------
    # Métodos "stub" para que los botones de la vista sean válidos
    # (Más adelante implementamos la lógica de marcar rubro rojo/amarillo)
    # -------------------------------------------------------------------------
    def action_mark_rubro_empty(self):
        """Marca un rubro como 'sin información' (amarillo). Placeholder."""
        # TODO: implementar lógica con el rubro en contexto o un modelo de estado
        # Por ahora, solo devuelve True para que la acción sea válida.
        return True

    def action_unmark_rubro_empty(self):
        """Desmarca el rubro 'sin información'. Placeholder."""
        return True

    # -------------------------------------------------------------------------
    # Cómputos placeholder (evitan errores en vistas de resumen)
    # -------------------------------------------------------------------------
    @api.depends('line_ids')  # afina dependencias cuando tengas site_id/type/rubro_code
    def _compute_totals(self):
        for site in self:
            # TODO: implementar fórmulas reales en Fase 2
            site.subtotal1 = 0.0
            site.admin_amt = 0.0
            site.util_amt = 0.0
            site.subtotal2 = 0.0
            site.transporte_amt = site.headcount * (site.transporte_rate or 0.0)
            site.bienestar_amt = site.headcount * (site.bienestar_rate or 0.0)
            site.financial_amt = 0.0
            site.total_monthly = 0.0
