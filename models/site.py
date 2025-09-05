from odoo import api, fields, models, _

class CCNServiceQuoteSite(models.Model):
    _name = "ccn.service.quote.site"
    _description = "Sitio de Service Quote"
    _order = "sequence, id"

    name = fields.Char(string="Nombre del sitio", required=True)
    sequence = fields.Integer(default=10)
    quote_id = fields.Many2one(
        "ccn.service.quote",
        string="Service Quote",
        required=True,
        ondelete="cascade",
        index=True,
    )
    type = fields.Selection(
        [
            ("garden", "Jardinería"),
            ("clean", "Limpieza"),
            ("maintenance", "Mantenimiento"),
            ("materials", "Materiales"),
        ],
        string="Tipo",
        required=True,
        default="garden",
    )

    headcount = fields.Integer(string="Plantilla", default=0)

    line_ids = fields.One2many("ccn.service.quote.line", "site_id", string="Líneas del sitio")

    # Parámetros por sitio
    admin_percent     = fields.Float(string="% Administración", digits=(5,2), default=0.0)
    utility_percent   = fields.Float(string="% Utilidad", digits=(5,2), default=0.0)
    financial_percent = fields.Float(string="% Costo financiero", digits=(5,2), default=0.0)
    transporte_rate   = fields.Monetary(string="Tarifa Transporte / persona", currency_field="currency_id", default=0.0)
    bienestar_rate    = fields.Monetary(string="Tarifa Bienestar / persona", currency_field="currency_id", default=0.0)

    currency_id = fields.Many2one("res.currency", default=lambda self: self.env.company.currency_id.id)

    # Indicadores clave
    subtotal1 = fields.Monetary(string="Subtotal 1", currency_field="currency_id", compute="_compute_kpis", store=False)
    admin_amt = fields.Monetary(string="Administración", currency_field="currency_id", compute="_compute_kpis", store=False)
    util_amt  = fields.Monetary(string="Utilidad", currency_field="currency_id", compute="_compute_kpis", store=False)
    subtotal2 = fields.Monetary(string="Subtotal 2", currency_field="currency_id", compute="_compute_kpis", store=False)
    transporte_amt = fields.Monetary(string="Transporte", currency_field="currency_id", compute="_compute_kpis", store=False)
    bienestar_amt  = fields.Monetary(string="Bienestar", currency_field="currency_id", compute="_compute_kpis", store=False)
    financial_amt  = fields.Monetary(string="Costo financiero", currency_field="currency_id", compute="_compute_kpis", store=False)
    total_monthly  = fields.Monetary(string="Total mensual", currency_field="currency_id", compute="_compute_kpis", store=False)

    @api.depends("line_ids.quantity", "line_ids.total_price",
                 "admin_percent", "utility_percent", "financial_percent",
                 "transporte_rate", "bienestar_rate")
    def _compute_kpis(self):
        # códigos de rubro 1..14 (ver datos del punto 2)
        RUBROS_SUB1 = {"mano_obra","uniforme","epp","epp_alturas",
                       "comunicacion_computo","herramienta_menor_jardineria",
                       "material_limpieza","**dummy_8**"}  # ver nota abajo
        # NOTA: en tu lista real el 8 es "Material de Limpieza"; ajusta nombres exactos.

        for s in self:
            sums = {}
            headcount = 0.0
            for l in s.line_ids:
                code = l.rubro_code  # helper @property en la línea, ver 1.2
                sums[code] = sums.get(code, 0.0) + (l.total_price or 0.0)
                if code == "mano_obra":
                    headcount += (l.quantity or 0.0)

            subtotal1 = sum(sums.get(k, 0.0) for k in RUBROS_SUB1)
            admin_amt = subtotal1 * (s.admin_percent/100.0)
            util_amt  = subtotal1 * (s.utility_percent/100.0)
            subtotal2 = subtotal1 + admin_amt + util_amt

            transporte_amt = headcount * (s.transporte_rate or 0.0)
            bienestar_amt  = headcount * (s.bienestar_rate or 0.0)

            base_fin = subtotal2 \
                       + sums.get("perfil_medico",0.0) \
                       + sums.get("maquinaria_limpieza",0.0) \
                       + sums.get("fertilizantes_tierra_lama",0.0) \
                       + sums.get("consumibles_jardineria",0.0) \
                       + transporte_amt + bienestar_amt \
                       + sums.get("maquinaria_jardineria",0.0)
            financial_amt = base_fin * (s.financial_percent/100.0)
            total_monthly = subtotal2 \
                            + sums.get("perfil_medico",0.0) \
                            + sums.get("maquinaria_limpieza",0.0) \
                            + sums.get("maquinaria_jardineria",0.0) \
                            + sums.get("fertilizantes_tierra_lama",0.0) \
                            + sums.get("consumibles_jardineria",0.0) \
                            + transporte_amt + bienestar_amt + financial_amt \
                            + sums.get("capacitacion",0.0)

            s.headcount = headcount
            s.subtotal1 = subtotal1
            s.admin_amt = admin_amt
            s.util_amt  = util_amt
            s.subtotal2 = subtotal2
            s.transporte_amt = transporte_amt
            s.bienestar_amt  = bienestar_amt
            s.financial_amt  = financial_amt
            s.total_monthly  = total_monthly
