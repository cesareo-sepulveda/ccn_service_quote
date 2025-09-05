# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class CCNServiceQuoteLine(models.Model):
    _name = "ccn.service.quote.line"
    _description = "Línea de CCN Service Quote"
    _order = "rubro_id, id"

    quote_id = fields.Many2one("ccn.service.quote", required=True, ondelete="cascade")
    rubro_id = fields.Many2one("ccn.service.rubro", string="Rubro", required=True)

    # dominio base: siempre ocultar placeholders
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

    @api.onchange("rubro_id")
    def _onchange_rubro_id_set_domain(self):
        """
        Cuando el usuario elige el Rubro en la línea, limitamos product_id
        a productos de ese rubro y que no sean placeholders.
        """
        dom = [('product_tmpl_id.ccn_exclude_from_quote', '=', False)]
        if self.rubro_id:
            dom.append(('product_tmpl_id.ccn_rubro_ids', 'in', [self.rubro_id.id]))
        return {'domain': {'product_id': dom}}

    @api.constrains('product_id')
    def _check_product_not_placeholder(self):
        for l in self:
            if l.product_id and l.product_id.product_tmpl_id.ccn_exclude_from_quote:
                raise ValidationError(_("Este producto está marcado como 'excluir de cotización'."))
            
    @api.constrains('product_id', 'rubro_id')
    def _check_product_matches_rubro(self):
        for rec in self:
            if rec.product_id:
                if not rec.rubro_id:
                    raise ValidationError(_("Seleccione un Rubro antes de elegir el Producto."))

                tmpl = rec.product_id.product_tmpl_id
                # Debe pertenecer al rubro y no estar excluido del selector
                if rec.rubro_id not in tmpl.ccn_rubro_ids or tmpl.ccn_exclude_from_quote:
                    raise ValidationError(
                        _("El producto '%s' no pertenece al Rubro '%s' o está marcado para no usarse en CCN Service Quote.")
                        % (rec.product_id.display_name, rec.rubro_id.display_name)
                    )
                
    tabulador = fields.Selection(
        selection=[
            ('0',  '0%'),
            ('3',  '3%'),
            ('5',  '5%'),
            ('10', '10%'),
        ],
        string='Tabulador',
        default='0',
        help='Porcentaje extra aplicado sobre el precio base de esta línea.'
    )

    # Recalcula el precio final cuando cambia el tabulador o el base
    @api.onchange('tabulador', 'base_price_unit')
    def _onchange_tabulador_or_base(self):
        for rec in self:
            try:
                pct = float(rec.tabulador or '0') / 100.0
            except Exception:
                pct = 0.0
            if rec.base_price_unit is not None:
                rec.price_unit_final = rec.base_price_unit * (1.0 + pct)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            t_raw = vals.get('tabulador', '0') or '0'
            try:
                t = float(t_raw) / 100.0
            except Exception:
                t = 0.0
            if 'base_price_unit' in vals and 'price_unit_final' not in vals:
                base = vals.get('base_price_unit') or 0.0
                vals['price_unit_final'] = base * (1.0 + t)
        return super().create(vals_list)

    def write(self, vals):
        res = super().write(vals)
        # Si el usuario cambió tabulador o base (y no envió explícitamente price_unit_final),
        # recalculamos para mantener coherencia en servidor.
        if any(k in vals for k in ('tabulador', 'base_price_unit')) and 'price_unit_final' not in vals:
            for rec in self:
                try:
                    pct = float(rec.tabulador or '0') / 100.0
                except Exception:
                    pct = 0.0
                if rec.base_price_unit is not None:
                    rec.price_unit_final = rec.base_price_unit * (1.0 + pct)
        return res

