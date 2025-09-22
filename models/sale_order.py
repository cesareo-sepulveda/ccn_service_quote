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

    def action_open_pick_quote_wizard(self):
        """Alias legacy para compatibilidad con vistas anteriores."""
        return self.action_ccn_add_service_quote()

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

        if mode == "itemized":
            # 1) Sección de SITIO (si hay)
            if getattr(quote, 'site_label', False):
                self.order_line.create({
                    "order_id": self.id,
                    "display_type": "line_section",
                    "name": f"SITIO: {quote.site_label}",
                    "sequence": seq,
                })
                seq += STEP

            # 2) Agrupar por rubro y ordenar
            grp = defaultdict(list)
            for l in quote.line_ids:
                grp[l.rubro_id].append(l)

            for rubro in sorted(grp.keys(), key=lambda r: (r.sequence, r.name or '')):
                lines = grp[rubro]

                # 2a) Rubro como sección (Odoo lo muestra en negritas)
                self.order_line.create({
                    "order_id": self.id,
                    "display_type": "line_section",
                    "name": rubro.name,
                    "sequence": seq,
                })
                seq += STEP

                # 2b) Productos normales (una línea)
                for l in lines:
                    taxes = l.product_id.taxes_id.filtered(lambda t: t.company_id == self.company_id)
                    desc = (l.product_id.get_product_multiline_description_sale()
                            or l.product_id.display_name)
                    name_one_line = " ".join((desc or "").splitlines()).strip() or l.product_id.display_name
                    self.order_line.create({
                        "order_id": self.id,
                        "product_id": l.product_id.id,
                        "name": name_one_line,
                        "product_uom": l.product_id.uom_id.id,
                        "product_uom_qty": l.quantity,
                        "price_unit": l.price_unit_final,
                        "tax_id": [(6, 0, taxes.ids)],
                        "sequence": seq,
                    })
                    seq += STEP

        elif mode == "by_rubro":
            grp = defaultdict(list)
            for l in quote.line_ids:
                grp[l.rubro_id].append(l)

            for rubro in sorted(grp.keys(), key=lambda r: (r.sequence, r.name or '')):
                lines = grp[rubro]
                total = sum(x.total_price for x in lines)

                # Línea con precio cuyo "producto" es el nombre del rubro (sin código)
                rubro_product = self._ccn_get_named_service_product(rubro.name)
                taxes = rubro_product.taxes_id.filtered(lambda t: t.company_id == self.company_id)
                self.order_line.create({
                    "order_id": self.id,
                    "product_id": rubro_product.id,
                    "name": rubro_product.name,
                    "product_uom_qty": 1.0,
                    "price_unit": total,
                    "tax_id": [(6, 0, taxes.ids)],
                    "sequence": seq,
                })
                seq += STEP

                # Detalle como nota (sin precios)
                txt = ", ".join(f"{x.product_id.display_name} x{x.quantity:g}" for x in lines)
                if txt:
                    self.order_line.create({
                        "order_id": self.id,
                        "display_type": "line_note",
                        "name": txt,
                        "sequence": seq,
                    })
                    seq += STEP

        else:  # total_only
            cat_product = self._ccn_get_category_product(quote.category)
            taxes = cat_product.taxes_id.filtered(lambda t: t.company_id == self.company_id)
            total = sum(quote.line_ids.mapped("total_price"))

            self.order_line.create({
                "order_id": self.id,
                "product_id": cat_product.id,
                "name": cat_product.name,
                "product_uom_qty": 1.0,
                "price_unit": total,
                "tax_id": [(6, 0, taxes.ids)],
                "sequence": seq,
            })
            seq += STEP

            detail_txt = ", ".join(f"{l.product_id.display_name} x{l.quantity:g}" for l in quote.line_ids)
            if detail_txt:
                self.order_line.create({
                    "order_id": self.id,
                    "display_type": "line_note",
                    "name": detail_txt,
                    "sequence": seq,
                })
                seq += STEP
