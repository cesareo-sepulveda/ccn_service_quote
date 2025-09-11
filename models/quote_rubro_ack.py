# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

RUBRO_CODES = [
    "mano_obra", "uniforme", "epp", "epp_alturas",
    "equipo_especial_limpieza", "comunicacion_computo",
    "herramienta_menor_jardineria", "material_limpieza",
    "perfil_medico", "maquinaria_limpieza", "maquinaria_jardineria",
    "fertilizantes_tierra_lama", "consumibles_jardineria", "capacitacion",
]

TYPE_SELECTION = [("garden", "Jardinería"), ("clean", "Limpieza")]


class CCNServiceQuoteAck(models.Model):
    _name = "ccn.service.quote.ack"
    _description = "Rubros aceptados sin datos"
    _rec_name = "rubro_id"

    quote_id = fields.Many2one("ccn.service.quote", required=True, ondelete="cascade")
    site_id = fields.Many2one("ccn.service.quote.site", required=True, ondelete="cascade")
    type = fields.Selection(TYPE_SELECTION, required=True)
    rubro_id = fields.Many2one("ccn.service.rubro", required=True, ondelete="cascade")

    _sql_constraints = [
        (
            "uniq_ack",
            "unique(quote_id,site_id,type,rubro_id)",
            "Este rubro ya fue marcado como 'aceptado sin datos' para este Sitio/Tipo.",
        )
    ]


class CCNServiceQuote(models.Model):
    _inherit = "ccn.service.quote"

    ack_ids = fields.One2many("ccn.service.quote.ack", "quote_id", string="Rubros aceptados")

    # --------- Estados por rubro (para sitio+tipo actuales) ----------
    rubro_state_mano_obra              = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_uniforme               = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_epp                    = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_epp_alturas            = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_equipo_especial_limpieza = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_comunicacion_computo   = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_herramienta_menor_jardineria = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_material_limpieza      = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_perfil_medico          = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_maquinaria_limpieza    = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_maquinaria_jardineria  = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_fertilizantes_tierra_lama = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_consumibles_jardineria = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")
    rubro_state_capacitacion           = fields.Selection([("red","Rojo"),("yellow","Amarillo"),("ok","OK")], compute="_compute_rubro_states")

    def _get_state_for(self, site, typ, rubro):
        self.ensure_one()
        lines = self.line_ids.filtered(
            lambda l: l.site_id.id == site.id and l.type == typ and l.rubro_id.id == rubro.id
        )
        if lines:
            return "ok"
        ack = self.ack_ids.filtered(
            lambda a: a.site_id.id == site.id and a.type == typ and a.rubro_id.id == rubro.id
        )
        return "yellow" if ack else "red"

    @api.depends("line_ids", "current_site_id", "current_type", "ack_ids")
    def _compute_rubro_states(self):
        for q in self:
            vals = {}
            site = q.current_site_id
            typ = q.current_type
            for code in RUBRO_CODES:
                field_name = f"rubro_state_{code}"
                if not site or not typ:
                    vals[field_name] = "red"
                    continue
                rubro = q.env.ref(f"ccn_service_quote.rubro_{code}", raise_if_not_found=False)
                if not rubro:
                    vals[field_name] = "red"
                    continue
                vals[field_name] = q._get_state_for(site, typ, rubro)
            q.update(vals)

    # --------- Acciones desde botones en las pestañas ----------
    def _ack_domain_ctx(self, rubro):
        self.ensure_one()
        return [
            ("quote_id", "=", self.id),
            ("site_id", "=", self.current_site_id.id),
            ("type", "=", self.current_type),
            ("rubro_id", "=", rubro.id),
        ]

    def action_mark_rubro_empty(self):
        self.ensure_one()
        code = self.env.context.get("rubro_code")
        rubro = self.env.ref(f"ccn_service_quote.rubro_{code}")
        if not self.current_site_id or not self.current_type:
            raise ValidationError(_("Selecciona primero Sitio y Tipo actuales."))
        if not self.env["ccn.service.quote.ack"].search(self._ack_domain_ctx(rubro), limit=1):
            self.env["ccn.service.quote.ack"].create({
                "quote_id": self.id,
                "site_id": self.current_site_id.id,
                "type": self.current_type,
                "rubro_id": rubro.id,
            })
        return True

    def action_unmark_rubro_empty(self):
        self.ensure_one()
        code = self.env.context.get("rubro_code")
        rubro = self.env.ref(f"ccn_service_quote.rubro_{code}")
        recs = self.env["ccn.service.quote.ack"].search(self._ack_domain_ctx(rubro))
        recs.unlink()
        return True

    # --------- Restricción: no permitir guardar con algún rubro rojo (sitio/tipo actual) ----------
    @api.constrains("line_ids", "ack_ids", "current_site_id", "current_type")
    def _constrains_no_red_in_current(self):
        for q in self:
            if not q.current_site_id or not q.current_type:
                continue
            for code in RUBRO_CODES:
                state = getattr(q, f"rubro_state_{code}")
                if state == "red":
                    raise ValidationError(_(
                        "Aún hay rubros en ROJO para el sitio/tipo actuales. "
                        "Completa líneas o marca explícitamente como 'Sin contenido'."
                    ))
