# -*- coding: utf-8 -*-
import logging
from odoo import api, fields, models

_logger = logging.getLogger(__name__)

class ServiceQuoteLineMigrate(models.Model):
    _inherit = 'ccn.service.quote.line'

    @api.model
    def migrate_fill_buckets(self, limit=0):
        """Rellena bucket_id para líneas existentes sin bucket.
        - Crea buckets faltantes por (quote_id, site_id, service_type, rubro_id).
        - Si falta rubro_id pero hay rubro_code, lo reconstituye.
        - Procesa en sudo (seguro en upgrade) y escribe en lotes por bucket.
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

        cache = {}  # (q, s, st, r) -> bucket record
        by_bucket_key = {}  # (q, s, st, r) -> [line ids]
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

        # Asegurar buckets y escribir en lotes
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
