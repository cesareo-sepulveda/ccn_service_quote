# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError
import logging
import time

_logger = logging.getLogger(__name__)

# -------------------------
# Catálogo de rubros (códigos)
# -------------------------
RUBRO_CODES = [
    ("mano_obra","Mano de Obra"),
    ("uniforme","Uniforme"),
    ("epp","EPP"),
    ("epp_alturas","EPP Alturas"),
    ("equipo_especial_limpieza","Equipo Especial de Limpieza"),
    ("comunicacion_computo","Comunicación y Cómputo"),
    ("herramienta_menor_jardineria","Herramienta Menor de Jardinería"),
    ("material_limpieza","Material de Limpieza"),
    ("perfil_medico","Perfil Médico"),
    ("maquinaria_limpieza","Maquinaria de Limpieza"),
    ("maquinaria_jardineria","Maquinaria de Jardinería"),
    ("fertilizantes_tierra_lama","Fertilizantes y Tierra Lama"),
    ("consumibles_jardineria","Consumibles de Jardinería"),
    ("capacitacion","Capacitación"),
]

# =====================================================================
# QUOTE (encabezado)
# =====================================================================
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'

    _sql_constraints = [
        ('ccn_service_quote_partner_name_uniq', 'unique(partner_id, name)',
         'El nombre de la cotización debe ser único por cliente.')
    ]

    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, index=True)
    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))

    currency_id = fields.Many2one(
        'res.currency', string='Moneda', required=True,
        default=lambda self: self.env.company.currency_id.id,
    )

    # Sitios
    def _default_site_ids(self):
        return [Command.create({'name': self.env._('General')})]

    site_ids = fields.One2many(
        "ccn.service.quote.site",
        "quote_id",
        string="Sitios",
        default=_default_site_ids,
    )

    current_site_id = fields.Many2one(
        'ccn.service.quote.site',
        string='Sitio actual',
        domain="[('quote_id','=', id)]",
    )

    # Temporal/diagnóstico: contador de sitios registrados para esta cotización
    site_count = fields.Integer(string='Total sitios', compute='_compute_site_count')

    current_service_type = fields.Selection(
        [
            ('jardineria', 'Jardinería'),
            ('limpieza', 'Limpieza'),
            ('mantenimiento', 'Mantenimiento'),
            ('materiales', 'Materiales'),
            ('servicios_especiales', 'Servicios Especiales'),
            ('almacenaje', 'Almacenaje'),
            ('fletes', 'Fletes'),
        ],
        string='Tipo de servicio',
    )

    current_type = fields.Selection(
        [('servicio', 'Servicio'), ('material', 'Material')],
        string='Tipo actual',
        default='servicio',
    )

    display_mode = fields.Selection(
        [
            ('by_rubro', 'Acumulado por rubro'),
            ('total_only', 'Acumulado General'),
            ('itemized', 'Resumen'),
        ],
        string='Modo de presentación',
        default='itemized',
        required=True,
    )
    admin_percent = fields.Float(string='Administración (%)', default=0.0)
    utility_percent = fields.Float(string='Utilidad (%)', default=0.0)
    financial_percent = fields.Float(string='Costo Financiero (%)', default=0.0)
    transporte_rate = fields.Float(string='Tarifa Transporte P/P', default=0.0)
    bienestar_rate = fields.Float(string='Tarifa Bienestar P/P', default=0.0)
    prestaciones_percent = fields.Float(string='Porcentaje prestaciones (%)', default=45.0)

    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas')

    # ACKs (No aplica) por rubro/sitio/tipo — para disparar recomputos de estado
    ack_ids = fields.One2many('ccn.service.quote.ack', 'quote_id', string='ACKs')

    # Versión instalada del módulo (para verificación rápida en UI)
    module_version = fields.Char(
        string='Versión módulo',
        compute='_compute_module_version',
        store=False,
        readonly=True,
    )

    # Campos separados por rubro para evitar duplicación en tabs
    # Mano de Obra (todas) — se mantiene por compatibilidad
    line_ids_mano_obra = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'mano_obra')],
        string='Líneas Mano de Obra')

    # Mano de Obra por tipo de servicio (para filtrar correctamente en UI sin recargar)
    line_ids_mano_obra_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'mano_obra'), ('service_type', '=', 'jardineria')],
        string='Líneas Mano de Obra — Jardinería')

    line_ids_mano_obra_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'mano_obra'), ('service_type', '=', 'limpieza')],
        string='Líneas Mano de Obra — Limpieza')
    # Uniforme (ambos servicios)
    line_ids_uniforme = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'uniforme')],
        string='Líneas Uniforme')
    line_ids_uniforme_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'uniforme'), ('service_type', '=', 'jardineria')],
        string='Líneas Uniforme — Jardinería')
    line_ids_uniforme_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'uniforme'), ('service_type', '=', 'limpieza')],
        string='Líneas Uniforme — Limpieza')
    # EPP (ambos servicios)
    line_ids_epp = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'epp')],
        string='Líneas EPP')
    line_ids_epp_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'epp'), ('service_type', '=', 'jardineria')],
        string='Líneas EPP — Jardinería')
    line_ids_epp_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'epp'), ('service_type', '=', 'limpieza')],
        string='Líneas EPP — Limpieza')
    line_ids_epp_alturas = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'epp_alturas')],
        string='Líneas EPP Alturas')
    line_ids_equipo_especial_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'equipo_especial_limpieza')],
        string='Líneas Equipo Especial Limpieza')
    # Comunicación y Cómputo (ambos servicios)
    line_ids_comunicacion_computo = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'comunicacion_computo')],
        string='Líneas Comunicación y Cómputo')
    line_ids_comunicacion_computo_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'comunicacion_computo'), ('service_type', '=', 'jardineria')],
        string='Líneas Comunicación y Cómputo — Jardinería')
    line_ids_comunicacion_computo_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'comunicacion_computo'), ('service_type', '=', 'limpieza')],
        string='Líneas Comunicación y Cómputo — Limpieza')
    line_ids_herramienta_menor_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'herramienta_menor_jardineria')],
        string='Líneas Herramienta Menor Jardinería')
    line_ids_material_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'material_limpieza')],
        string='Líneas Material Limpieza')
    # Perfil Médico (ambos servicios)
    line_ids_perfil_medico = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'perfil_medico')],
        string='Líneas Perfil Médico')
    line_ids_perfil_medico_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'perfil_medico'), ('service_type', '=', 'jardineria')],
        string='Líneas Perfil Médico — Jardinería')
    line_ids_perfil_medico_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'perfil_medico'), ('service_type', '=', 'limpieza')],
        string='Líneas Perfil Médico — Limpieza')
    line_ids_maquinaria_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'maquinaria_limpieza')],
        string='Líneas Maquinaria Limpieza')
    line_ids_maquinaria_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'maquinaria_jardineria')],
        string='Líneas Maquinaria Jardinería')
    line_ids_fertilizantes_tierra_lama = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'fertilizantes_tierra_lama')],
        string='Líneas Fertilizantes y Tierra Lama')
    line_ids_consumibles_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'consumibles_jardineria')],
        string='Líneas Consumibles Jardinería')
    # Capacitación (ambos servicios)
    line_ids_capacitacion = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'capacitacion')],
        string='Líneas Capacitación')
    line_ids_capacitacion_jardineria = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'capacitacion'), ('service_type', '=', 'jardineria')],
        string='Líneas Capacitación — Jardinería')
    line_ids_capacitacion_limpieza = fields.One2many(
        'ccn.service.quote.line', 'quote_id',
        domain=[('rubro_id.code', '=', 'capacitacion'), ('service_type', '=', 'limpieza')],
        string='Líneas Capacitación — Limpieza')


    # Estados por rubro (filtrados por sitio/servicio/tipo actual)
    rubro_state_mano_obra                 = fields.Integer(compute="_compute_rubro_states")
    rubro_state_uniforme                  = fields.Integer(compute="_compute_rubro_states")
    rubro_state_epp                       = fields.Integer(compute="_compute_rubro_states")
    rubro_state_epp_alturas               = fields.Integer(compute="_compute_rubro_states")
    rubro_state_equipo_especial_limpieza  = fields.Integer(compute="_compute_rubro_states")
    rubro_state_comunicacion_computo      = fields.Integer(compute="_compute_rubro_states")
    rubro_state_herramienta_menor_jardineria = fields.Integer(compute="_compute_rubro_states")
    rubro_state_material_limpieza         = fields.Integer(compute="_compute_rubro_states")
    rubro_state_perfil_medico             = fields.Integer(compute="_compute_rubro_states")
    rubro_state_maquinaria_limpieza       = fields.Integer(compute="_compute_rubro_states")
    rubro_state_maquinaria_jardineria     = fields.Integer(compute="_compute_rubro_states")
    rubro_state_fertilizantes_tierra_lama = fields.Integer(compute="_compute_rubro_states")
    rubro_state_consumibles_jardineria    = fields.Integer(compute="_compute_rubro_states")
    rubro_state_capacitacion              = fields.Integer(compute="_compute_rubro_states")

    # Estados por rubro y servicio específico (para vistas)
    rubro_state_mano_obra_jard                 = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_uniforme_jard                  = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_epp_jard                       = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_epp_alturas_jard               = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_equipo_especial_limpieza_jard  = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_comunicacion_computo_jard      = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_herramienta_menor_jardineria_jard = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_material_limpieza_jard         = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_perfil_medico_jard             = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_maquinaria_limpieza_jard       = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_maquinaria_jardineria_jard     = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_fertilizantes_tierra_lama_jard = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_consumibles_jardineria_jard    = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_capacitacion_jard              = fields.Integer(compute="_compute_rubro_states_per_service")

    rubro_state_mano_obra_limp                 = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_uniforme_limp                  = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_epp_limp                       = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_epp_alturas_limp               = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_equipo_especial_limpieza_limp  = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_comunicacion_computo_limp      = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_herramienta_menor_jardineria_limp = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_material_limpieza_limp         = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_perfil_medico_limp             = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_maquinaria_limpieza_limp       = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_maquinaria_jardineria_limp     = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_fertilizantes_tierra_lama_limp = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_consumibles_jardineria_limp    = fields.Integer(compute="_compute_rubro_states_per_service")
    rubro_state_capacitacion_limp              = fields.Integer(compute="_compute_rubro_states_per_service")

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type', 'line_ids.type',
        'current_site_id', 'current_service_type', 'current_type',
        # Disparar cuando cambian ACKs de esta cotización
        'ack_ids', 'ack_ids.site_id', 'ack_ids.service_type', 'ack_ids.rubro_code', 'ack_ids.is_empty'
    )
    def _compute_rubro_states(self):
        def _site_for_compute(rec):
            sid = rec.current_site_id.id if rec.current_site_id else False
            if not sid and rec.site_ids:
                gen = rec.site_ids.filtered(lambda s: (s.name or '').strip().lower() == 'general')
                sid = (gen[:1].id if gen else rec.site_ids[:1].id) or False
            return sid

        def state_for(rec, code):
            site_id = _site_for_compute(rec)
            # Considerar líneas del rubro en el sitio, independientemente del tipo de servicio
            # IMPORTANTE: Solo contar líneas GUARDADAS (con id), ignorar líneas temporales en memoria
            lines = rec.line_ids.filtered(lambda l:
                l.id and  # ← CLAVE: Solo líneas guardadas en BD
                (not site_id or l.site_id.id == site_id) and
                ((getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == code)
            )
            cnt = len(lines)
            # ACK en cualquier tipo de servicio para ese sitio/rubro
            # IMPORTANTE: Si no hay site_id válido, NO buscar ACKs (devolver False para evitar falsos positivos)
            ack = False
            if site_id:
                ack = self.env['ccn.service.quote.ack'].search_count([
                    ('quote_id', '=', rec.id),
                    ('site_id', '=', site_id),
                    ('service_type', 'in', ['jardineria','limpieza','mantenimiento','materiales','servicios_especiales','almacenaje','fletes']),
                    ('rubro_code', '=', code),
                    ('is_empty', '=', True),
                ]) > 0
            return 1 if cnt > 0 else (2 if ack else 0)

        for rec in self:
            rec.rubro_state_mano_obra                 = state_for(rec, 'mano_obra')
            rec.rubro_state_uniforme                  = state_for(rec, 'uniforme')
            rec.rubro_state_epp                       = state_for(rec, 'epp')
            rec.rubro_state_epp_alturas               = state_for(rec, 'epp_alturas')
            rec.rubro_state_equipo_especial_limpieza  = state_for(rec, 'equipo_especial_limpieza')
            rec.rubro_state_comunicacion_computo      = state_for(rec, 'comunicacion_computo')
            rec.rubro_state_herramienta_menor_jardineria = state_for(rec, 'herramienta_menor_jardineria')
            rec.rubro_state_material_limpieza         = state_for(rec, 'material_limpieza')
            rec.rubro_state_perfil_medico             = state_for(rec, 'perfil_medico')
            rec.rubro_state_maquinaria_limpieza       = state_for(rec, 'maquinaria_limpieza')
            rec.rubro_state_maquinaria_jardineria     = state_for(rec, 'maquinaria_jardineria')
            rec.rubro_state_fertilizantes_tierra_lama = state_for(rec, 'fertilizantes_tierra_lama')
            rec.rubro_state_consumibles_jardineria    = state_for(rec, 'consumibles_jardineria')
            rec.rubro_state_capacitacion              = state_for(rec, 'capacitacion')

    @api.depends(
        'line_ids', 'line_ids.rubro_id', 'line_ids.rubro_code',
        'line_ids.site_id', 'line_ids.service_type', 'line_ids.type',
        'current_site_id', 'current_service_type',
        'ack_ids', 'ack_ids.site_id', 'ack_ids.service_type', 'ack_ids.rubro_code', 'ack_ids.is_empty'
    )
    def _compute_rubro_states_per_service(self):
        def _site_for_compute(rec):
            sid = rec.current_site_id.id if rec.current_site_id else False
            if not sid and rec.site_ids:
                gen = rec.site_ids.filtered(lambda s: (s.name or '').strip().lower() == 'general')
                sid = (gen[:1].id if gen else rec.site_ids[:1].id) or False
            return sid

        def state_for_service(rec, code, service_type):
            site_id = _site_for_compute(rec)
            # Buscar líneas del rubro en el sitio actual del servicio
            # IMPORTANTE: Solo contar líneas GUARDADAS (con id), ignorar líneas temporales en memoria
            lines = rec.line_ids.filtered(lambda l:
                l.id and  # ← CLAVE: Solo líneas guardadas en BD
                (not site_id or l.site_id.id == site_id) and
                l.service_type == service_type and
                ((getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)) == code)
            )
            cnt = len(lines)

            # Buscar ACKs para este sitio, servicio y rubro
            # IMPORTANTE: Si no hay site_id válido, NO buscar ACKs (devolver False para evitar falsos positivos)
            ack = False
            if site_id:
                ack = self.env['ccn.service.quote.ack'].search_count([
                    ('quote_id', '=', rec.id),
                    ('site_id', '=', site_id),
                    ('service_type', '=', service_type),
                    ('rubro_code', '=', code),
                    ('is_empty', '=', True),
                ]) > 0

            return 1 if cnt > 0 else (2 if ack else 0)

        for rec in self:
            # Jardinería
            rec.rubro_state_mano_obra_jard                 = state_for_service(rec, 'mano_obra', 'jardineria')
            rec.rubro_state_uniforme_jard                  = state_for_service(rec, 'uniforme', 'jardineria')
            rec.rubro_state_epp_jard                       = state_for_service(rec, 'epp', 'jardineria')
            rec.rubro_state_epp_alturas_jard               = state_for_service(rec, 'epp_alturas', 'jardineria')
            rec.rubro_state_equipo_especial_limpieza_jard  = state_for_service(rec, 'equipo_especial_limpieza', 'jardineria')
            rec.rubro_state_comunicacion_computo_jard      = state_for_service(rec, 'comunicacion_computo', 'jardineria')
            rec.rubro_state_herramienta_menor_jardineria_jard = state_for_service(rec, 'herramienta_menor_jardineria', 'jardineria')
            rec.rubro_state_material_limpieza_jard         = state_for_service(rec, 'material_limpieza', 'jardineria')
            rec.rubro_state_perfil_medico_jard             = state_for_service(rec, 'perfil_medico', 'jardineria')
            rec.rubro_state_maquinaria_limpieza_jard       = state_for_service(rec, 'maquinaria_limpieza', 'jardineria')
            rec.rubro_state_maquinaria_jardineria_jard     = state_for_service(rec, 'maquinaria_jardineria', 'jardineria')
            rec.rubro_state_fertilizantes_tierra_lama_jard = state_for_service(rec, 'fertilizantes_tierra_lama', 'jardineria')
            rec.rubro_state_consumibles_jardineria_jard    = state_for_service(rec, 'consumibles_jardineria', 'jardineria')
            rec.rubro_state_capacitacion_jard              = state_for_service(rec, 'capacitacion', 'jardineria')

            # Limpieza
            rec.rubro_state_mano_obra_limp                 = state_for_service(rec, 'mano_obra', 'limpieza')
            rec.rubro_state_uniforme_limp                  = state_for_service(rec, 'uniforme', 'limpieza')
            rec.rubro_state_epp_limp                       = state_for_service(rec, 'epp', 'limpieza')
            rec.rubro_state_epp_alturas_limp               = state_for_service(rec, 'epp_alturas', 'limpieza')
            rec.rubro_state_equipo_especial_limpieza_limp  = state_for_service(rec, 'equipo_especial_limpieza', 'limpieza')
            rec.rubro_state_comunicacion_computo_limp      = state_for_service(rec, 'comunicacion_computo', 'limpieza')
            rec.rubro_state_herramienta_menor_jardineria_limp = state_for_service(rec, 'herramienta_menor_jardineria', 'limpieza')
            rec.rubro_state_material_limpieza_limp         = state_for_service(rec, 'material_limpieza', 'limpieza')
            rec.rubro_state_perfil_medico_limp             = state_for_service(rec, 'perfil_medico', 'limpieza')
            rec.rubro_state_maquinaria_limpieza_limp       = state_for_service(rec, 'maquinaria_limpieza', 'limpieza')
            rec.rubro_state_maquinaria_jardineria_limp     = state_for_service(rec, 'maquinaria_jardineria', 'limpieza')
            rec.rubro_state_fertilizantes_tierra_lama_limp = state_for_service(rec, 'fertilizantes_tierra_lama', 'limpieza')
            rec.rubro_state_consumibles_jardineria_limp    = state_for_service(rec, 'consumibles_jardineria', 'limpieza')
            rec.rubro_state_capacitacion_limp              = state_for_service(rec, 'capacitacion', 'limpieza')

    # ACK granular
    def _ensure_ack(self, rubro_code, value):
        for rec in self:
            if not (rec.current_service_type and rubro_code):
                continue
            # Asegurar que el sitio pertenezca a la misma cotización; si no, usar/crear 'General'
            site = rec.current_site_id
            try:
                if not site or (site.quote_id and site.quote_id.id != rec.id):
                    sid = self.env['ccn.service.quote.site'].get_or_create_general(rec.id)
                    site = self.env['ccn.service.quote.site'].browse(sid)
            except Exception:
                site = rec.current_site_id
            ack = self.env['ccn.service.quote.ack'].search([
                ('quote_id', '=', rec.id),
                ('site_id', '=', site.id if site else False),
                ('service_type', '=', rec.current_service_type),
                ('rubro_code', '=', rubro_code),
            ], limit=1)
            if ack:
                ack.write({'is_empty': bool(value)})
            else:
                self.env['ccn.service.quote.ack'].create({
                    'quote_id': rec.id,
                    'site_id': site.id if site else False,
                    'service_type': rec.current_service_type,
                    'rubro_code': rubro_code,
                    'is_empty': bool(value),
                })

    def action_mark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._ensure_ack(code, True)
        return False

    def action_unmark_rubro_empty(self):
        code = (self.env.context or {}).get('rubro_code')
        if code:
            self._ensure_ack(code, False)
        return False

    # (Unificado) Abrir catálogo directo vía client action

    # Botón para garantizar/crear Sitio "General"
    def action_ensure_general(self):
        Site = self.env['ccn.service.quote.site'].with_context(active_test=False)
        for quote in self:
            general = Site.search([
                ('quote_id', '=', quote.id),
                ('name', '=ilike', 'general'),
            ], limit=1)
            if general:
                general.write({'active': True, 'sequence': -999})
            else:
                general = Site.create({
                    'quote_id': quote.id,
                    'name': 'General',
                    'active': True,
                    'sequence': -999,
                })
            quote.current_site_id = general.id
        return True

    # Dispara client action JS que abre el selector de productos (sin wizard puente)
    def action_open_catalog_wizard(self):
        self.ensure_one()
        ctx = dict(self.env.context or {})
        ctx.update({
            'active_model': self._name,
            'active_id': self.id,
            'quote_id': self.id,
            'site_id': self.current_site_id.id if self.current_site_id else False,
            'service_type': self.current_service_type or False,
            # rubro proviene del contexto del botón en la pestaña
            'rubro_code': ctx.get('rubro_code') or ctx.get('ctx_rubro_code') or False,
        })
        return {
            'type': 'ir.actions.client',
            'tag': 'ccn_catalog_direct_select',
            'context': ctx,
        }

    # Defaults para que "General" aparezca de inmediato
    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        defaults.setdefault("site_ids", self._default_site_ids())
        return defaults

    @api.onchange("site_ids")
    def _onchange_site_ids_set_current(self):
        for quote in self:
            if quote.site_ids:
                if quote.current_site_id not in quote.site_ids:
                    quote.current_site_id = quote.site_ids[0]
            else:
                quote.current_site_id = False

    @api.onchange('current_service_type')
    def _onchange_current_service_type(self):
        for quote in self:
            quote.current_type = 'material' if quote.current_service_type == 'materiales' else 'servicio'
            # Forzar recomputo de estados para actualizar colores
            quote._compute_rubro_states()
            quote._compute_rubro_states_per_service()
            # Forzar trigger del JavaScript para que lea los nuevos campos
            quote.tab_update_trigger = int(time.time())

    @api.depends('site_ids', 'site_ids.active', 'site_ids.name')
    def _compute_site_count(self):
        for rec in self:
            # Contar incluyendo registros en memoria (x2many no guardados todavía)
            try:
                rec.site_count = len(rec.site_ids.with_context(active_test=False))
            except Exception:
                rec.site_count = len(rec.site_ids)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('site_ids'):
                vals['site_ids'] = self._default_site_ids()
        quotes = super().create(vals_list)
        for quote in quotes:
            if not quote.current_site_id and quote.site_ids:
                quote.current_site_id = quote.site_ids[0].id
            # Si el current_site_id existe pero está huérfano (sin quote_id), enlazarlo a esta cotización
            if quote.current_site_id and not quote.current_site_id.quote_id:
                quote.current_site_id.write({'quote_id': quote.id})
        return quotes

    # Usado por data/migrate_fix_general.xml
    @api.model
    def _fix_general_sites(self, limit=100000):
        Site = self.env['ccn.service.quote.site'].with_context(active_test=False)
        quotes = self.search([], limit=limit)
        for q in quotes:
            general = Site.search([
                ('quote_id', '=', q.id),
                ('name', '=ilike', 'general'),
            ], limit=1)
            if general:
                general.write({'active': True, 'sequence': -999})
            else:
                general = Site.create({
                    'quote_id': q.id,
                    'name': 'General',
                    'active': True,
                    'sequence': -999,
                })
            if not q.current_site_id:
                q.write({'current_site_id': general.id})
        return True

    def write(self, vals):
        res = super().write(vals)
        # Si se cambió current_site_id y el sitio no tiene quote_id, enlazarlo
        if 'current_site_id' in vals:
            for rec in self:
                site = rec.current_site_id
                if site and not site.quote_id:
                    site.write({'quote_id': rec.id})
                # Mantener flags de is_current sincronizados SIEMPRE
                if site:
                    (rec.site_ids - site).with_context(ccn_syncing_current_site=True).write({'is_current': False})
                    site.with_context(ccn_syncing_current_site=True).write({'is_current': True})
        return res

    @api.onchange('site_ids', 'site_ids.is_current')
    def _onchange_site_ids_current_flag(self):
        for quote in self:
            sites = quote.site_ids
            if not sites:
                continue
            current_sites = sites.filtered(lambda s: bool(s.is_current))
            if not current_sites:
                # Si no hay ninguno marcado, preferir el actual del encabezado o el primero
                if quote.current_site_id and quote.current_site_id in sites:
                    quote.current_site_id.is_current = True
                    current_sites = quote.current_site_id
                else:
                    sites[0].is_current = True
                    current_sites = sites[0]
            elif len(current_sites) > 1:
                # Dejar solo uno activo. Preferir el que coincide con current_site_id
                prefer = current_sites.filtered(lambda s: s.id and quote.current_site_id and s.id == quote.current_site_id.id) or current_sites[:1]
                for s in (current_sites - prefer):
                    s.is_current = False
                current_sites = prefer
            # Sincronizar encabezado
            if current_sites:
                quote.current_site_id = current_sites[0]

    # === Utilidad: versión instalada del módulo ===
    @api.depends()
    def _compute_module_version(self):
        ver = ''
        try:
            mod = self.env['ir.module.module'].sudo().search([('name', '=', 'ccn_service_quote')], limit=1)
            ver = getattr(mod, 'installed_version', None) or getattr(mod, 'latest_version', None) or ''
        except Exception:
            ver = ''
        for rec in self:
            rec.module_version = ver


# =====================================================================
# LÍNEA (detalle)
# =====================================================================
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
        required=True,
        ondelete='restrict',
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

    # ⚠️ Char compute (NO related) para evitar choque con Selection de rubro_id.code
    rubro_code = fields.Char(
        string='Código de Rubro',
        compute='_compute_rubro_code',
        store=False,
        readonly=True,
        index=True,
    )

    # Producto (filtrado por rubro)
    product_id = fields.Many2one(
        'product.product',
        string='Producto/Servicio',
        required=True,
        index=True,
        # Evitamos 'in' con lista vacía; usamos OR de igualdades
        domain="['&', ('product_tmpl_id.ccn_exclude_from_quote','=',False), "
               "'&', ('product_tmpl_id.sale_ok','=', True), "
               "'|', ('product_tmpl_id.ccn_rubro_ids.code','=', context.get('ctx_rubro_code')), "
                     "('product_tmpl_id.ccn_rubro_ids.code','=', rubro_code)]",
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
        store=True,
    )
    price_unit_final = fields.Monetary(
        string='Precio Unitario',
        compute='_compute_price_unit_final',
        store=True,
    )
    taxes_display = fields.Char(
        string='Detalle de impuestos',
        compute='_compute_taxes_display',
        store=False,
    )
    amount_tax = fields.Monetary(
        string='IVA',
        compute='_compute_amount_tax',
        store=False,
        currency_field='currency_id',
    )
    total_price = fields.Monetary(
        string='Total Mensual',
        compute='_compute_total_price',
        store=False,
    )

    # Frecuencia y subtotal mensual
    frequency = fields.Selection([
        ('weekly', 'Semanal'),
        ('fortnight_14', 'Catorcenal'),
        ('biweekly', 'Quincenal'),
        ('monthly', 'Mensual'),
        ('bimonthly', 'Bimestral'),
        ('quarterly', 'Trimestral'),
        ('semiannual', 'Semestral'),
        ('annual', 'Anual'),
        ('18m', '18 Meses'),
        ('24m', '24 Meses'),
    ], string='Frecuencia', default='monthly', required=True)

    monthly_subtotal = fields.Monetary(
        string='Subtotal Mensual',
        compute='_compute_monthly_subtotal',
        store=True,
        currency_field='currency_id',
    )

    # Prestaciones (solo aplica a Mano de Obra; en otros rubros = 0)
    mo_prestaciones = fields.Monetary(
        string='Prestaciones',
        compute='_compute_mo_prestaciones',
        store=False,
        currency_field='currency_id',
    )

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

    @api.depends('quantity', 'monthly_subtotal', 'quote_id.prestaciones_percent', 'rubro_code')
    def _compute_total_price(self):
        for line in self:
            # Total Mensual:
            # - Mano de Obra: (Percepción Mensual + Prestaciones) x Cantidad
            # - Otros rubros: Subtotal Mensual x Cantidad
            if (line.rubro_code or '').strip() == 'mano_obra':
                base = (line.monthly_subtotal or 0.0) + (line.mo_prestaciones or 0.0)
                val = base * (line.quantity or 0.0)
            else:
                val = (line.monthly_subtotal or 0.0) * (line.quantity or 0.0)
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.total_price = val

    @api.depends('monthly_subtotal', 'quote_id.prestaciones_percent', 'rubro_code')
    def _compute_mo_prestaciones(self):
        for line in self:
            if (line.rubro_code or '').strip() == 'mano_obra':
                perc = (getattr(line.quote_id, 'prestaciones_percent', 0.0) or 0.0) / 100.0
                val = (line.monthly_subtotal or 0.0) * perc
            else:
                val = 0.0
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.mo_prestaciones = val

    @api.depends('price_unit_final', 'frequency')
    def _compute_monthly_subtotal(self):
        for line in self:
            # Subtotal mensual unitario (no multiplicado por cantidad)
            unit_total = (line.price_unit_final or 0.0)
            f = (line.frequency or 'monthly')
            # Factores a mes equivalente
            if f == 'weekly':
                factor = 30.42 / 7.0
            elif f == 'fortnight_14':
                factor = 30.42 / 14.0
            elif f == 'biweekly':
                factor = 2.0
            elif f == 'monthly':
                factor = 1.0
            elif f == 'bimonthly':
                factor = 1.0 / 2.0
            elif f == 'quarterly':
                factor = 1.0 / 3.0
            elif f == 'semiannual':
                factor = 1.0 / 6.0
            elif f == 'annual':
                factor = 1.0 / 12.0
            elif f == '18m':
                factor = 1.0 / 18.0
            elif f == '24m':
                factor = 1.0 / 24.0
            else:
                factor = 1.0

            val = unit_total * factor
            if line.quote_id.currency_id:
                val = line.quote_id.currency_id.round(val)
            line.monthly_subtotal = val

    # ===== Defaults desde contexto =====
    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        ctx = self.env.context or {}

        if 'default_quote_id' in ctx and 'quote_id' in self._fields:
            res.setdefault('quote_id', ctx.get('default_quote_id'))

        if 'default_site_id' in ctx and 'site_id' in self._fields:
            res.setdefault('site_id', ctx.get('default_site_id'))

        # Salvaguarda: si no hay site_id pero sí quote_id, usar/crear 'General'
        if not res.get('site_id'):
            qid = res.get('quote_id') or ctx.get('default_quote_id')
            if qid:
                try:
                    res['site_id'] = self.env['ccn.service.quote.site'].get_or_create_general(qid)
                except Exception:
                    pass

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

    # Onchange para reforzar el dominio de producto por rubro
    @api.onchange('rubro_id')
    def _onchange_rubro_id(self):
        code = self.rubro_id.code if self.rubro_id else False
        return {
            'domain': {
                'product_id': [
                    ('product_tmpl_id.ccn_exclude_from_quote','=', False),
                    '|',
                        ('product_tmpl_id.ccn_rubro_ids.code','=', code),
                        ('product_tmpl_id.ccn_rubro_ids.code','=', False),  # evita dominio inválido si no hay code
                ]
            }
        }

    # Coherencia: el sitio debe pertenecer a la misma cotización
    @api.constrains('site_id', 'quote_id')
    def _check_site_belongs_to_quote(self):
        for line in self:
            # Validar solo si ambos están definidos y el sitio ya tiene quote asignada
            if line.site_id and line.quote_id and line.site_id.quote_id and line.site_id.quote_id != line.quote_id:
                raise ValidationError("El sitio de la línea pertenece a otra cotización.")

    # Validación adicional: asegurar que todos los campos necesarios estén presentes para garantizar independencia
    @api.constrains('site_id', 'service_type', 'rubro_id', 'quote_id')
    def _check_line_independence_fields(self):
        """Valida que las líneas tengan todos los campos necesarios para garantizar independencia de datos."""
        for line in self:
            if not line.site_id:
                raise ValidationError("Cada línea debe tener un sitio asignado para garantizar independencia de datos.")
            if not line.service_type:
                raise ValidationError("Cada línea debe tener un tipo de servicio asignado para garantizar independencia de datos.")
            if not line.rubro_id:
                raise ValidationError("Cada línea debe tener un rubro asignado para garantizar independencia de datos.")

    @api.model_create_multi
    def create(self, vals_list):
        # Garantiza site_id siempre presente: si falta, usa/crea 'General' del quote
        for vals in vals_list:
            if not vals.get('site_id'):
                qid = vals.get('quote_id') or (self.env.context or {}).get('default_quote_id')
                if qid:
                    try:
                        vals['site_id'] = self.env['ccn.service.quote.site'].get_or_create_general(qid)
                    except Exception:
                        # permitir que el required dispare error si no logramos resolverlo
                        pass
        return super().create(vals_list)
