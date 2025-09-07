# -*- coding: utf-8 -*-
from odoo import api, fields, models

# Debe coincidir con ccn.service.rubro.code
RUBRO_CODES = [
    ("mano_obra", "Mano de Obra"),
    ("uniforme", "Uniforme"),
    ("epp", "EPP"),
    ("epp_alturas", "EPP Alturas"),
    ("equipo_especial_limpieza", "Equipo Especial de Limpieza"),
    ("comunicacion_computo", "Comunicación y Cómputo"),
    ("herramienta_menor_jardineria", "Herramienta Menor de Jardinería"),
    ("material_limpieza", "Material de Limpieza"),
    ("perfil_medico", "Perfil Médico"),
    ("maquinaria_limpieza", "Maquinaria de Limpieza"),
    ("maquinaria_jardineria", "Maquinaria de Jardinería"),
    ("fertilizantes_tierra_lama", "Fertilizantes y Tierra Lama"),
    ("consumibles_jardineria", "Consumibles de Jardinería"),
    ("capacitacion", "Capacitación"),
]

class CCNServiceQuoteLine(models.Model):
    _name = "ccn.service.quote.line"
    _description = "Línea de CCN Service Quote"
    _order = "rubro_id, id"

    # Fase 1
    quote_id = fields.Many2one("ccn.service.quote", required=True, ondelete="cascade")
    rubro_id = fields.Many2one("ccn.service.rubro", string="Rubro", required=True)
    product_id = fields.Many2one(
        "product.product",
        string="Producto/Servicio",
        required=True,
        domain="[('product_tmpl_id.ccn_exclude_from_quote','=',False)]",
    )
    quantity = fields.Float(string="Cantidad", default=1.0, required=True)
    base_price_unit = fields.Monetary(
        string="Precio base",
        currency_field="currency_id",
        help="Lista base del producto al cotizar",
    )
    tabulator_percent = fields.Selection(
        [("0", "0%"), ("3", "3%"), ("5", "5%"), ("10", "10%")],
        string="Tabulador extra (%)",
        default="0",
        help="Porcentaje adicional aplicado a esta línea (oculto al cliente).",
    )
    price_unit_final = fields.Monetary(string="Precio con tabulador", currency_field="currency_id")
    total_price = fields.Monetary(
        string="Importe",
        compute="_compute_total",
        currency_field="currency_id",
        store=True,
    )
    currency_id = fields.Many2one(related="quote_id.currency_id", store=True, readonly=True)

    # Fase 2: dimensión Sitio + Tipo
    site_id = fields.Many2one("ccn.service.quote.site", string="Sitio", ondelete="cascade")
    type = fields.Selection([("garden", "Jardinería"), ("clean", "Limpieza")], string="Tipo")

    # Para poder filtrar por código de rubro sin usar ref() en vistas
    rubro_code = fields.Selection(
        RUBRO_CODES, related="rubro_id.code", store=True, readonly=True
    )

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
