# -*- coding: utf-8 -*-
"""Partner and user fields for service quotes."""

from logging import getLogger

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


_logger = getLogger(__name__)

class CCNServiceQuote(models.Model):
    _inherit = "ccn.service.quote"

    partner_id = fields.Many2one(
        "res.partner",
        string="Cliente",
        index=True,
        help="Cliente dueño de la cotización.",
    )
    user_id = fields.Many2one("res.users", string="Responsable")

    @api.model_create_multi
    def create(self, vals_list):
        """Force a customer when creating service quotes."""
        ctx = self.env.context or {}
        ctx_partner = next(
            (
                ctx.get(key)
                for key in ("default_partner_id", "force_partner_id", "ccn_partner_id")
                if ctx.get(key)
            ),
            False,
        )

        prepared_vals = []
        for vals in vals_list:
            vals = dict(vals)
            partner_id = vals.get("partner_id") or ctx_partner
            if not partner_id:
                raise ValidationError(_("Debes seleccionar un cliente para la cotización."))
            vals["partner_id"] = partner_id
            prepared_vals.append(vals)
        return super().create(prepared_vals)

    def write(self, vals):
        """Avoid clearing the partner relation."""
        if "partner_id" in vals and not vals["partner_id"]:
            raise ValidationError(_("No puedes quitar el cliente de la cotización."))
        return super().write(vals)

    def _auto_init(self):
        """Log any legacy quotes missing a customer relation."""
        res = super()._auto_init()
        self.env.cr.execute(
            "SELECT COUNT(1) FROM ccn_service_quote WHERE partner_id IS NULL"
        )
        missing = self.env.cr.fetchone()[0]
        if missing:
            _logger.warning(
                "Se encontraron %s cotizaciones CCN sin cliente asignado; "
                "actualízalas manualmente para aprovechar la nueva jerarquía.",
                missing,
            )
        return res
