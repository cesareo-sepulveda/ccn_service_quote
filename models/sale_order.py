# -*- coding: utf-8 -*-
from collections import defaultdict
from odoo import models, _
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval

class SaleOrder(models.Model):
    _inherit = "sale.order"

    def action_ccn_add_service_quote(self):
        """Abrir selector de Cotizador Especial CCN, filtrando por cliente y corrigiendo context."""
        self.ensure_one()

        # Lee la acción del wizard/selector
        action = self.env.ref('ccn_service_quote.action_ccn_pick_quote').read()[0]

        # Normalizar context (en 18.0 puede venir como string)
        ctx_raw = action.get('context') or {}
        if isinstance(ctx_raw, str):
            try:
                ctx = safe_eval(ctx_raw) or {}
            except Exception:
                ctx = {}
        elif isinstance(ctx_raw, dict):
            ctx = dict(ctx_raw)
        else:
            ctx = {}

        # Pasar datos al wizard/acción
        ctx.update({
            'default_order_id': self.id,
            'ccn_partner_id': self.partner_id.id if self.partner_id else False,
        })
        action['context'] = ctx

        if self.partner_id:
            # Claves útiles para filtros y defaults
            ctx.update({
                'ccn_partner_id': self.partner_id.id,          # por si tu vista usa domain="[...] context.get('ccn_partner_id') ..."
                'search_default_partner_id': self.partner_id.id, # activa filtro rápido si hay filtro guardado
                'default_partner_id': self.partner_id.id,        # default en asistentes/m2o
                'force_partner_id': self.partner_id.id,          # por si lo lees explícitamente en el wizard
            })

        action['context'] = ctx

        # Si la acción apunta directo al modelo ccn.service.quote, forzar domain por cliente
        if self.partner_id and action.get('res_model') == 'ccn.service.quote':
            # Sobrescribo cualquier dominio previo para asegurar el filtro por cliente
            action['domain'] = [('partner_id', '=', self.partner_id.id)]

        # Importante en 18.0: no devolver 'tree' en ningún view_mode desde Python
        # (El XML de la acción debe usar list,form; aquí no tocamos view_mode)

        return action

    # ----------------- Helpers de producto "contenedor" -----------------

    def _ccn_get_category_product(self, category):
        """Devuelve 'Servicio de Jardinería/Limpieza' y lo marca como excluido del selector de quote."""
        label = "Servicio de Jardinería" if category == "garden" else "Servicio de Limpieza"
        Product = self.env['product.product']
        product = Product.search([('name', '=', label), ('type', '=', 'service')], limit=1)
        if not product:
            product = Product.create({'name': label, 'type': 'service', 'list_price': 0.0, 'default_code': False})
        else:
            if product.default_code:
                product.default_code = False
        # marcar el template para que NO aparezca en service_quote
        tmpl = product.product_tmpl_id
        if hasattr(tmpl, 'ccn_exclude_from_quote') and not tmpl.ccn_exclude_from_quote:
            tmpl.ccn_exclude_from_quote = True
        return product

    def _ccn_get_named_service_product(self, name):
        """Producto de servicio con nombre = rubro (contenedor para modo por rubro). Ocúltalo del selector de quote."""
        Product = self.env['product.product']
        product = Product.search([('name', '=', name), ('type', '=', 'service')], limit=1)
        if not product:
            product = Product.create({'name': name, 'type': 'service', 'list_price': 0.0, 'default_code': False})
        else:
            if product.default_code:
                product.default_code = False
        tmpl = product.product_tmpl_id
        if hasattr(tmpl, 'ccn_exclude_from_quote') and not tmpl.ccn_exclude_from_quote:
            tmpl.ccn_exclude_from_quote = True
        return product

    # ----------------- Importador principal -----------------

    def ccn_import_from_quote(self, quote):
        """
        Inserta líneas en la SO según display_mode de la service_quote, con validaciones de cliente.
        """
        self.ensure_one()

        # --- VALIDACIONES DE CLIENTE ---
        if not self.partner_id:
            raise UserError(_("Primero selecciona un Cliente en la Orden de Venta."))
        if not quote.partner_id:
            raise UserError(_("La cotización seleccionada no tiene Cliente asignado."))
        if quote.partner_id.id != self.partner_id.id:
            raise UserError(_(
                "El cliente de la cotización (%s) no coincide con el de la orden (%s)."
            ) % (quote.partner_id.display_name, self.partner_id.display_name))

        # --- VALIDACIONES DE CONTENIDO ---
        if not quote.line_ids:
            raise UserError(_("La cotización seleccionada no tiene líneas."))

        # Orden de inserción
        current_max = max(self.order_line.mapped('sequence') or [0])
        seq = current_max + 10
        STEP = 10

        # 0) Nota general como sección (si hay)
        if getattr(quote, 'note_text', False):
            self.order_line.create({
                "order_id": self.id,
                "display_type": "line_section",
                "name": quote.note_text,
                "sequence": seq,
            })
            seq += STEP

        mode = quote.display_mode

        # ¿Hay múltiples sitios? Solo en ese caso añadimos la sección "SITIO: ..."
        site_ids_set = set(l.site_id.id for l in quote.line_ids if l.site_id)
        multiple_sites = len(site_ids_set) > 1

        # Helper: etiqueta de tipo de servicio
        def _srv_label(srv):
            return {
                'jardineria': _('Jardinería'),
                'limpieza': _('Limpieza'),
                'mantenimiento': _('Mantenimiento'),
                'materiales': _('Materiales'),
                'servicios_especiales': _('Servicios Especiales'),
                'almacenaje': _('Almacenaje'),
                'fletes': _('Fletes'),
            }.get(srv or '', srv or '')

        # Agrupar por sitio
        by_site = defaultdict(list)
        for l in quote.line_ids:
            by_site[l.site_id].append(l)

        if mode == "itemized":  # Resumen → 1 partida por sitio con total global del sitio
            for site, lines in by_site.items():
                total_site = sum(x.total_price for x in lines)
                # tipos presentes en el sitio
                types = []
                seen = set()
                for x in lines:
                    if x.service_type and x.service_type not in seen:
                        seen.add(x.service_type)
                        types.append(_srv_label(x.service_type))
                tipos_txt = " y ".join(types) if types else _("Servicio")

                label = _("Servicio de %s") % (tipos_txt,)
                product = self._ccn_get_named_service_product(label)
                taxes = product.taxes_id.filtered(lambda t: t.company_id == self.company_id)

                # Sección por sitio solo si hay múltiples sitios
                if site and multiple_sites:
                    self.order_line.create({
                        "order_id": self.id,
                        "display_type": "line_section",
                        "name": _("SITIO: %s") % (site.name,),
                        "sequence": seq,
                    })
                    seq += STEP

                self.order_line.create({
                    "order_id": self.id,
                    "product_id": product.id,
                    "name": product.name,
                    "product_uom_qty": 1.0,
                    "price_unit": total_site,
                    "tax_id": [(6, 0, taxes.ids)],
                    "sequence": seq,
                })
                seq += STEP

        elif mode == "total_only":  # Acumulado General → 1 partida por tipo de servicio en cada sitio
            for site, lines in by_site.items():
                if site and multiple_sites:
                    self.order_line.create({
                        "order_id": self.id,
                        "display_type": "line_section",
                        "name": _("SITIO: %s") % (site.name,),
                        "sequence": seq,
                    })
                    seq += STEP

                by_type = defaultdict(list)
                for x in lines:
                    by_type[x.service_type].append(x)

                for srv, lst in by_type.items():
                    total_srv = sum(x.total_price for x in lst)
                    label = _("Servicio de %s") % (_srv_label(srv),)
                    product = self._ccn_get_named_service_product(label)
                    taxes = product.taxes_id.filtered(lambda t: t.company_id == self.company_id)
                    self.order_line.create({
                        "order_id": self.id,
                        "product_id": product.id,
                        "name": product.name,
                        "product_uom_qty": 1.0,
                        "price_unit": total_srv,
                        "tax_id": [(6, 0, taxes.ids)],
                        "sequence": seq,
                    })
                    seq += STEP

        else:  # by_rubro → partidas por rubro, separadas por sitio y tipo de servicio
            for site, lines in by_site.items():
                if site and multiple_sites:
                    self.order_line.create({
                        "order_id": self.id,
                        "display_type": "line_section",
                        "name": _("SITIO: %s") % (site.name,),
                        "sequence": seq,
                    })
                    seq += STEP

                by_type = defaultdict(list)
                for x in lines:
                    by_type[x.service_type].append(x)

                for srv, lst in by_type.items():
                    # Sub-sección por tipo de servicio
                    self.order_line.create({
                        "order_id": self.id,
                        "display_type": "line_section",
                        "name": _("Servicio: %s") % (_srv_label(srv),),
                        "sequence": seq,
                    })
                    seq += STEP

                    by_rubro = defaultdict(list)
                    for x in lst:
                        by_rubro[x.rubro_id].append(x)

                    for rubro in sorted(by_rubro.keys(), key=lambda r: (getattr(r, 'sequence', 0), getattr(r, 'name', '') or '')):
                        r_lines = by_rubro[rubro]
                        total_rubro = sum(x.total_price for x in r_lines)
                        rubro_product = self._ccn_get_named_service_product(rubro.name)
                        taxes = rubro_product.taxes_id.filtered(lambda t: t.company_id == self.company_id)
                        self.order_line.create({
                            "order_id": self.id,
                            "product_id": rubro_product.id,
                            "name": rubro_product.name,
                            "product_uom_qty": 1.0,
                            "price_unit": total_rubro,
                            "tax_id": [(6, 0, taxes.ids)],
                            "sequence": seq,
                        })
                        seq += STEP
