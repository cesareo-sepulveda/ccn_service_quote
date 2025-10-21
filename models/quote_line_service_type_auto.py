# -*- coding: utf-8 -*-
from odoo import api, models

class ServiceQuoteLineServiceTypeAuto(models.Model):
    _inherit = 'ccn.service.quote.line'

    @api.model_create_multi
    def create(self, vals_list):
        """
        Asegurar que el service_type sea correcto basándose en el rubro_code.

        Rubros exclusivos de jardinería deben tener service_type='jardineria'
        Rubros exclusivos de limpieza deben tener service_type='limpieza'
        """
        # Mapeo de rubro_code a service_type correcto
        RUBRO_TO_SERVICE = {
            # Rubros exclusivos de jardinería
            'herramienta_menor_jardineria': 'jardineria',
            'maquinaria_jardineria': 'jardineria',
            'fertilizantes_tierra_lama': 'jardineria',
            'consumibles_jardineria': 'jardineria',
            'epp_alturas': 'jardineria',

            # Rubros exclusivos de limpieza
            'material_limpieza': 'limpieza',
            'maquinaria_limpieza': 'limpieza',
            'equipo_especial_limpieza': 'limpieza',
        }

        for vals in vals_list:
            # Si ya tiene service_type, no sobreescribir (respetar lo que viene del contexto)
            if vals.get('service_type'):
                continue

            # Obtener rubro_code (puede venir directo o del rubro_id)
            rubro_code = vals.get('rubro_code')

            # Si no hay rubro_code pero hay rubro_id, obtenerlo
            if not rubro_code and vals.get('rubro_id'):
                rubro = self.env['ccn.service.rubro'].browse(vals['rubro_id'])
                if rubro.exists():
                    rubro_code = rubro.code

            # Asignar service_type correcto si es un rubro específico
            if rubro_code and rubro_code in RUBRO_TO_SERVICE:
                vals['service_type'] = RUBRO_TO_SERVICE[rubro_code]

        return super().create(vals_list)

    def write(self, vals):
        """
        Si se cambia el rubro_code o rubro_id, actualizar service_type si es necesario.
        """
        # Solo procesar si se está cambiando rubro_code o rubro_id
        if 'rubro_code' not in vals and 'rubro_id' not in vals:
            return super().write(vals)

        RUBRO_TO_SERVICE = {
            'herramienta_menor_jardineria': 'jardineria',
            'maquinaria_jardineria': 'jardineria',
            'fertilizantes_tierra_lama': 'jardineria',
            'consumibles_jardineria': 'jardineria',
            'epp_alturas': 'jardineria',
            'material_limpieza': 'limpieza',
            'maquinaria_limpieza': 'limpieza',
            'equipo_especial_limpieza': 'limpieza',
        }

        # Si se está cambiando explícitamente service_type, respetarlo
        if 'service_type' in vals:
            return super().write(vals)

        # Obtener rubro_code del vals o del registro
        rubro_code = vals.get('rubro_code')
        if not rubro_code and vals.get('rubro_id'):
            rubro = self.env['ccn.service.rubro'].browse(vals['rubro_id'])
            if rubro.exists():
                rubro_code = rubro.code

        # Si no está en vals pero estamos cambiando rubro, usar el del registro
        if not rubro_code:
            for rec in self:
                rubro_code = rec.rubro_code or (rec.rubro_id.code if rec.rubro_id else None)
                if rubro_code and rubro_code in RUBRO_TO_SERVICE:
                    vals['service_type'] = RUBRO_TO_SERVICE[rubro_code]
                break  # Aplicar la misma lógica a todos
        elif rubro_code in RUBRO_TO_SERVICE:
            vals['service_type'] = RUBRO_TO_SERVICE[rubro_code]

        return super().write(vals)
