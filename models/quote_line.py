# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CCNServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'
    _order = 'id desc'

    # Relaciones principales
    quote_id = fields.Many2one(
        'ccn.service.quote',
        string='Cotización',
        required=True,
        ondelete='cascade',
        index=True,
    )
    site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio',
        ondelete='set null',
        index=True,
    )

    # Contexto de vista
    service_type = fields.Selection([
        ('jardineria', 'Jardinería'),
        ('limpieza', 'Limpieza'),
        ('mantenimiento', 'Mantenimiento'),
        ('materiales', 'Materiales'),
        ('servicios_especiales', 'Servicios Especiales'),
        ('almacenaje', 'Almacenaje'),
        ('fletes', 'Fletes'),
    ], string='Tipo de Servicio', index=True)

    type = fields.Selection([
        ('servicio', 'Servicio'),
        ('material', 'Material'),
    ], string='Tipo', default='servicio', required=True, index=True)

    # Rubro
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro', index=True)
    rubro_code = fields.Char(
        string='Código de Rubro',
        related='rubro_id.code',
        store=True,
        readonly=True,
        index=True,
    )

    # Producto
    product_id = fields.Many2one(
        'product.product',
        string='Producto/Servicio',
        required=True,
        index=True,
    )

    # Cantidad
    quantity = fields.Float(string='Cantidad', default=1.0)

    # Moneda
    currency_id = fields.Many2one(
        'res.currency',
        string='Moneda',
        related='quote_id.currency_id',
        store=True,
        readonly=True,
    )

    # Tabulador
    tabulator_percent = fields.Selection(
        [('0', '0%'), ('3', '3%'), ('5', '5%'), ('10', '10%')],
        string='Tabulador',
        default='0',
        required=True,
    )

    # Precios / impuestos / totales (simplificados)
    product_base_price = fields.Monetary(
        string='Precio base',
        compute='_compute_product_base_price',
        store=False,
    )
    price_unit_final = fields.Monetary(
        string='Precio Unitario',
        compute='_compute_price_unit_final',
        store=False,
    )
    # Muestra de impuestos (descriptivo)
    taxes_display = fields.Char(
        string='Detalle de impuestos',
        compute='_compute_taxes_display',
        store=False,
    )
    # IVA estimado (opcional; para compatibilidad con vistas que lo usan)
    amount_tax = fields.Monetary(
        string='IVA',
        compute='_compute_amount_tax',
        store=False,
        currency_field='currency_id',
    )
    total_price = fields.Monetary(
        string='Subtotal final',
        compute='_compute_total_price',
        store=False,
    )

    # ==========================
    # Cómputos
    # ==========================
    @api.depends('product_id')
    def _compute_product_base_price(self):
        for line in self:
            val = line.product_id.list_price if line.product_id else 0.0
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.product_base_price = val

    @api.depends('product_base_price', 'tabulator_percent')
    def _compute_price_unit_final(self):
        for line in self:
            base = line.product_base_price or 0.0
            tab = float(line.tabulator_percent or '0') / 100.0
            val = base * (1.0 + tab)
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.price_unit_final = val

    @api.depends('product_id')
    def _compute_taxes_display(self):
        tax_model = self.env.get('account.tax')
        for line in self:
            txt = ''
            taxes = getattr(line.product_id, 'taxes_id', False)
            if tax_model and taxes:
                txt = ', '.join(taxes.mapped('name'))
            line.taxes_display = txt

    @api.depends('price_unit_final', 'quantity', 'product_id')
    def _compute_amount_tax(self):
        """Cálculo simple del IVA (suma de porcentajes) para mostrar.
        No reemplaza el motor fiscal de Odoo."""
        for line in self:
            total = (line.price_unit_final or 0.0) * (line.quantity or 0.0)
            rate = 0.0
            taxes = getattr(line.product_id, 'taxes_id', False)
            if taxes:
                # Suma simple de porcentajes (percent)
                rate = sum(t.amount for t in taxes if getattr(t, 'amount_type', 'percent') == 'percent') / 100.0
            amt = total * rate
            if line.quote_id.currency_id:
                amt = line.quote_id.currency_id.round(amt)
            line.amount_tax = amt

    @api.depends('quantity', 'price_unit_final')
    def _compute_total_price(self):
        for line in self:
            val = (line.price_unit_final or 0.0) * (line.quantity or 0.0)
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.total_price = val

    # ==========================
    # Defaults desde contexto
    # ==========================
    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}

        if 'default_quote_id' in ctx and 'quote_id' in self._fields:
            res.setdefault('quote_id', ctx.get('default_quote_id'))

        if 'default_site_id' in ctx and 'site_id' in self._fields:
            res.setdefault('site_id', ctx.get('default_site_id'))

        if 'default_type' in ctx and 'type' in self._fields:
            res.setdefault('type', ctx.get('default_type'))

        if 'default_service_type' in ctx and 'service_type' in self._fields:
            res.setdefault('service_type', ctx.get('default_service_type'))

        # Fijar rubro por pestaña (ctx_rubro_code)
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id

        return res
