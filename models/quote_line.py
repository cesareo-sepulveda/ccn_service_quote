# -*- coding: utf-8 -*-
import logging
from odoo import api, fields, models

_logger = logging.getLogger(__name__)

SERVICE_TYPES = [
    ('jardineria', 'Jardinería'),
    ('limpieza', 'Limpieza'),
    ('mantenimiento', 'Mantenimiento'),
    ('materiales', 'Materiales'),
    ('servicios_especiales', 'Servicios Especiales'),
    ('almacenaje', 'Almacenaje'),
    ('fletes', 'Fletes'),
]

class ServiceQuoteLine(models.Model):
    _name = 'ccn.service.quote.line'
    _description = 'CCN Service Quote Line'
    _order = 'id desc'

    # --- Anclaje principal al bucket (Sitio × Tipo × Rubro)
    bucket_id = fields.Many2one(
        'ccn.service.quote.scope.rubro',
        string='Bucket Sitio/Tipo/Rubro',
        ondelete='cascade',
        index=True,
    )

    # --- Relaciones directas (compatibilidad con vistas/compute)
    quote_id = fields.Many2one('ccn.service.quote', string='Cotización', required=True, ondelete='cascade', index=True)
    site_id = fields.Many2one('ccn.service.quote.site', string='Sitio', ondelete='set null', index=True)
    service_type = fields.Selection(SERVICE_TYPES, string='Tipo de Servicio', index=True)
    type = fields.Selection([('servicio', 'Servicio'), ('material', 'Material')], string='Tipo', default='servicio', required=True, index=True)

    # --- Rubro
    rubro_id = fields.Many2one('ccn.service.rubro', string='Rubro', index=True)
    rubro_code = fields.Char(string='Código de Rubro', compute='_compute_rubro_code', store=True, readonly=True, index=True)

    # --- Producto
    product_id = fields.Many2one(
        'product.product',
        string='Producto/Servicio',
        required=True,
        index=True,
        domain="['&', ('product_tmpl_id.ccn_exclude_from_quote','=',False), "
               "'|', ('product_tmpl_id.ccn_rubro_ids.code','=', context.get('ctx_rubro_code')), "
                     "('product_tmpl_id.ccn_rubro_ids.code','=', rubro_code)]",
    )

    # --- Datos
    quantity = fields.Float(string='Cantidad', default=1.0)
    currency_id = fields.Many2one('res.currency', string='Moneda', related='quote_id.currency_id', store=True, readonly=True)
    tabulator_percent = fields.Selection([('0','0%'), ('3','3%'), ('5','5%'), ('10','10%')], string='Tabulador', default='0', required=True)

    # --- Totales
    product_base_price = fields.Monetary(string='Precio base', compute='_compute_product_base_price', store=True)
    price_unit_final = fields.Monetary(string='Precio Unitario', compute='_compute_price_unit_final', store=True)
    taxes_display = fields.Char(string='Detalle de impuestos', compute='_compute_taxes_display', store=False)
    amount_tax = fields.Monetary(string='IVA', compute='_compute_amount_tax', store=False, currency_field='currency_id')
    total_price = fields.Monetary(string='Subtotal final', compute='_compute_total_price', store=False)

    _sql_constraints = [
        ('uniq_line_in_bucket', 'unique(bucket_id, product_id)',
         'Ese producto ya existe en el mismo Sitio/Tipo/Rubro.'),
    ]

    # ===== Cómputos =====
    @api.depends('rubro_id', 'rubro_id.code')
    def _compute_rubro_code(self):
        for rec in self:
            rec.rubro_code = rec.rubro_id.code or False

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
        for line in self:
            total = (line.price_unit_final or 0.0) * (line.quantity or 0.0)
            rate = 0.0
            taxes = getattr(line.product_id, 'taxes_id', False)
            if taxes:
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

    # ===== Defaults =====
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

        # Rubro desde pestaña
        code = ctx.get('ctx_rubro_code')
        if code and 'rubro_id' in self._fields and not res.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
            if rubro:
                res['rubro_id'] = rubro.id

        return res

    @api.onchange('rubro_id')
    def _onchange_rubro_id(self):
        code = self.rubro_id.code if self.rubro_id else False
        return {
            'domain': {
                'product_id': [
                    ('product_tmpl_id.ccn_exclude_from_quote', '=', False),
                    '|',
                    ('product_tmpl_id.ccn_rubro_ids.code', '=', code),
                    ('product_tmpl_id.ccn_rubro_ids.code', '=', False),
                ]
            }
        }

    # ===== Helper interno =====
    def _ensure_bucket(self, vals):
        """Asegura bucket_id en vals (o lo crea) usando quote_id, site_id, service_type y rubro_id."""
        if vals.get('bucket_id'):
            return

        quote_id = vals.get('quote_id')
        site_id = vals.get('site_id')
        service_type = vals.get('service_type')
        rubro_id = vals.get('rubro_id')

        # Intenta rubro por contexto si no viene
        if not rubro_id:
            code = (self.env.context or {}).get('ctx_rubro_code')
            if code:
                rubro = self.env['ccn.service.rubro'].search([('code', '=', code)], limit=1)
                rubro_id = rubro.id if rubro else False
                if rubro_id:
                    vals['rubro_id'] = rubro_id

        if quote_id and site_id and service_type and rubro_id:
            Bucket = self.env['ccn.service.quote.scope.rubro']
            bucket = Bucket.search([
                ('quote_id', '=', quote_id),
                ('site_id', '=', site_id),
                ('service_type', '=', service_type),
                ('rubro_id', '=', rubro_id),
            ], limit=1)
            if not bucket:
                bucket = Bucket.create({
                    'quote_id': quote_id,
                    'site_id': site_id,
                    'service_type': service_type,
                    'rubro_id': rubro_id,
                })
            vals['bucket_id'] = bucket.id

    # ===== ORM overrides =====
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            # Tipo por default coherente con service_type
            if not vals.get('type') and vals.get('service_type') == 'materiales':
                vals['type'] = 'material'
            # Asegurar bucket
            self._ensure_bucket(vals)
            # Sincronizar campos directos si llegamos con bucket recién creado
            if vals.get('bucket_id') and (not vals.get('quote_id') or not vals.get('site_id') or not vals.get('service_type')):
                b = self.env['ccn.service.quote.scope.rubro'].browse(vals['bucket_id'])
                vals.setdefault('quote_id', b.quote_id.id)
                vals.setdefault('site_id', b.site_id.id)
                vals.setdefault('service_type', b.service_type)
                vals.setdefault('rubro_id', b.rubro_id.id)
        recs = super().create(vals_list)
        _logger.info("ServiceQuoteLine created: %s", recs.ids)
        return recs

    def write(self, vals):
        # Si cambian ejes, re-ubicar bucket
        axes = {'quote_id', 'site_id', 'service_type', 'rubro_id'}
        if axes.intersection(vals.keys()):
            for rec in self:
                merged = {
                    'quote_id': vals.get('quote_id', rec.quote_id.id),
                    'site_id': vals.get('site_id', rec.site_id.id),
                    'service_type': vals.get('service_type', rec.service_type),
                    'rubro_id': vals.get('rubro_id', rec.rubro_id.id),
                    'bucket_id': vals.get('bucket_id', rec.bucket_id.id),
                }
                if not merged['bucket_id'] or any(k in vals for k in ['quote_id','site_id','service_type','rubro_id']):
                    self._ensure_bucket(merged)
                    vals['bucket_id'] = merged['bucket_id']
                    # Alinear rubro_code después del cambio de rubro_id
                    if 'rubro_id' in vals:
                        vals.setdefault('rubro_code', self.env['ccn.service.rubro'].browse(vals['rubro_id']).code)
        return super().write(vals)

    # ===== Migración in-place (antes estaba en un módulo aparte) =====
    @api.model
    def migrate_fill_buckets(self, limit=0):
        """Rellena bucket_id para líneas existentes sin bucket.
        - Crea buckets por (quote_id, site_id, service_type, rubro_id).
        - Si falta rubro_id pero hay rubro_code, lo reconstituye.
        - Es idempotente; se puede re-ejecutar.
        """
        Line = self.sudo()
        Rubro = self.env['ccn.service.rubro'].sudo()
        Bucket = self.env['ccn.service.quote.scope.rubro'].sudo()

        dom = [('bucket_id', '=', False)]
        lines = Line.search(dom, order='id')
        if limit and limit > 0:
            lines = lines[:limit]

        total = len(lines)
        if not total:
            _logger.info("migrate_fill_buckets: nada por hacer (0 líneas sin bucket).")
            return True

        cache = {}           # (q, s, st, r) -> bucket record
        by_bucket_key = {}   # (q, s, st, r) -> [line ids]
        skipped = 0
        fixed_rubro = 0

        for l in lines:
            q = l.quote_id.id
            s = l.site_id.id
            st = l.service_type
            r = l.rubro_id.id

            # Backfill de rubro_id usando rubro_code si es necesario
            if not r and l.rubro_code:
                rb = Rubro.search([('code', '=', l.rubro_code)], limit=1)
                if rb:
                    l.write({'rubro_id': rb.id})
                    r = rb.id
                    fixed_rubro += 1

            if not (q and s and st and r):
                skipped += 1
                continue

            key = (q, s, st, r)
            by_bucket_key.setdefault(key, []).append(l.id)

        updated = 0
        for key, line_ids in by_bucket_key.items():
            q, s, st, r = key
            bucket = cache.get(key)
            if not bucket:
                bucket = Bucket.search([
                    ('quote_id', '=', q),
                    ('site_id', '=', s),
                    ('service_type', '=', st),
                    ('rubro_id', '=', r),
                ], limit=1)
                if not bucket:
                    bucket = Bucket.create({
                        'quote_id': q,
                        'site_id': s,
                        'service_type': st,
                        'rubro_id': r,
                    })
                cache[key] = bucket
            Line.browse(line_ids).write({'bucket_id': bucket.id})
            updated += len(line_ids)

        _logger.info(
            "migrate_fill_buckets: total=%s, actualizadas=%s, reconst_rubro=%s, omitidas=%s, buckets=%s",
            total, updated, fixed_rubro, skipped, len(cache),
        )
        return True
