# -*- coding: utf-8 -*-
"""
Método auxiliar para corregir service_type de líneas.
NOTA: Este método se usó para migración inicial. Está comentado para no aparecer en la UI.
Si necesitas ejecutarlo manualmente, descomenta y actualiza el módulo.
"""
from odoo import api, models
import logging

_logger = logging.getLogger(__name__)

class ServiceQuoteFixServiceType(models.Model):
    _inherit = 'ccn.service.quote'

    # Método comentado - solo para uso excepcional desde shell Python
    # Para ejecutar: env['ccn.service.quote'].browse(ID).action_fix_service_type_all_lines()

    def action_fix_service_type_all_lines(self):
        """
        Botón manual para corregir el service_type de todas las líneas
        de esta cotización basándose en su rubro_code.

        Útil cuando el script de migración no se ejecutó o para datos existentes.
        """
        self.ensure_one()

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

        corrected_count = 0

        for line in self.line_ids:
            # Obtener rubro_code (puede estar en el campo o en el rubro_id)
            rubro_code = line.rubro_code or (line.rubro_id.code if line.rubro_id else None)

            if not rubro_code or rubro_code not in RUBRO_TO_SERVICE:
                continue

            correct_service = RUBRO_TO_SERVICE[rubro_code]

            # Solo actualizar si es necesario
            if line.service_type != correct_service:
                line.write({'service_type': correct_service})
                corrected_count += 1
                _logger.info(
                    f"Corregida línea {line.id}: rubro='{rubro_code}' -> service_type='{correct_service}'"
                )

        # Forzar recálculo de estados
        self._compute_rubro_states()
        self._compute_rubro_states_per_service()

        # Mostrar mensaje al usuario
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Corrección Completada',
                'message': f'Se corrigieron {corrected_count} líneas. '
                          f'Refresca la página para ver los cambios.',
                'type': 'success',
                'sticky': False,
            }
        }
