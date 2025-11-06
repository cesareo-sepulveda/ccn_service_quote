# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import ValidationError, UserError
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

# Rubros que aplican para cada tipo de servicio
RUBROS_POR_SERVICIO = {
    'jardineria': {
        'mano_obra', 'uniforme', 'epp', 'epp_alturas', 'comunicacion_computo',
        'herramienta_menor_jardineria', 'perfil_medico', 'maquinaria_jardineria',
        'fertilizantes_tierra_lama', 'consumibles_jardineria', 'capacitacion'
    },
    'limpieza': {
        'mano_obra', 'uniforme', 'epp', 'equipo_especial_limpieza',
        'comunicacion_computo', 'material_limpieza', 'perfil_medico',
        'maquinaria_limpieza', 'capacitacion'
    }
}

# =====================================================================
# QUOTE (encabezado)
# =====================================================================
class ServiceQuote(models.Model):
    _name = 'ccn.service.quote'
    _description = 'CCN Service Quote'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    _sql_constraints = [
        ('ccn_service_quote_partner_name_uniq', 'unique(partner_id, name)',
         'El nombre de la cotización debe ser único por cliente.')
    ]

    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, index=True,
                                  readonly=True, states={'draft': [('readonly', False)], 'pending': [('readonly', False)]})
    name = fields.Char(string='Nombre', required=True, default=lambda self: _('Nueva Cotización'))

    # Estado de la cotización
    state = fields.Selection([
        ('draft', 'Borrador'),
        ('pending', 'Pendiente'),
        ('authorized', 'Autorizado'),
    ], string='Estado', default='draft', required=True, tracking=True, copy=False)

    # Verificar si puede solicitar autorización (todos los tabs están completos)
    can_request_authorization = fields.Boolean(
        string='Puede solicitar autorización',
        compute='_compute_can_request_authorization',
        store=False,
    )

    # Verificar si el usuario actual es autorizador
    is_authorizer = fields.Boolean(
        string='Es autorizador',
        compute='_compute_is_authorizer',
        store=False,
    )

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
        readonly=True,
        states={'draft': [('readonly', False)], 'pending': [('readonly', False)]},
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
            ('resumen_sitio', 'Resumen del Sitio'),
            ('jardineria', 'Jardinería'),
            ('limpieza', 'Limpieza'),
            ('mantenimiento', 'Mantenimiento'),
            ('materiales', 'Materiales'),
            ('servicios_especiales', 'Servicios Especiales'),
            ('almacenaje', 'Almacenaje'),
            ('fletes', 'Fletes'),
        ],
        string='Tipo de servicio',
        default='resumen_sitio',
        required=True,
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

    line_ids = fields.One2many('ccn.service.quote.line', 'quote_id', string='Líneas',
                               readonly=True, states={'draft': [('readonly', False)], 'pending': [('readonly', False)]})

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
    rubro_state_mano_obra                 = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_uniforme                  = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_epp                       = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_epp_alturas               = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_equipo_especial_limpieza  = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_comunicacion_computo      = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_herramienta_menor_jardineria = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_material_limpieza         = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_perfil_medico             = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_maquinaria_limpieza       = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_maquinaria_jardineria     = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_fertilizantes_tierra_lama = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_consumibles_jardineria    = fields.Integer(compute="_compute_rubro_states", store=True)
    rubro_state_capacitacion              = fields.Integer(compute="_compute_rubro_states", store=True)

    # Estados por rubro y servicio específico (para vistas)
    rubro_state_mano_obra_jard                 = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_uniforme_jard                  = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_epp_jard                       = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_epp_alturas_jard               = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_equipo_especial_limpieza_jard  = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_comunicacion_computo_jard      = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_herramienta_menor_jardineria_jard = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_material_limpieza_jard         = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_perfil_medico_jard             = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_maquinaria_limpieza_jard       = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_maquinaria_jardineria_jard     = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_fertilizantes_tierra_lama_jard = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_consumibles_jardineria_jard    = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_capacitacion_jard              = fields.Integer(compute="_compute_rubro_states_per_service", store=True)

    rubro_state_mano_obra_limp                 = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_uniforme_limp                  = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_epp_limp                       = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_epp_alturas_limp               = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_equipo_especial_limpieza_limp  = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_comunicacion_computo_limp      = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_herramienta_menor_jardineria_limp = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_material_limpieza_limp         = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_perfil_medico_limp             = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_maquinaria_limpieza_limp       = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_maquinaria_jardineria_limp     = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_fertilizantes_tierra_lama_limp = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_consumibles_jardineria_limp    = fields.Integer(compute="_compute_rubro_states_per_service", store=True)
    rubro_state_capacitacion_limp              = fields.Integer(compute="_compute_rubro_states_per_service", store=True)

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

        for rec in self:
            site_id = _site_for_compute(rec)

            # Conjuntos de códigos por líneas guardadas en el sitio
            line_codes_site = set()
            if rec.line_ids:
                for l in rec.line_ids:
                    try:
                        # Considerar también líneas en memoria (no guardadas) para reflejar
                        # estado VERDE inmediatamente en UI tras cambiar de servicio.
                        if site_id and (not l.site_id or l.site_id.id != site_id):
                            continue
                        code = getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)
                        if code:
                            line_codes_site.add(code)
                    except Exception:
                        continue

            # Conjunto de ACKs por código (cualquier servicio) en el sitio
            ack_codes_any = set()
            if site_id and rec.ack_ids:
                for a in rec.ack_ids:
                    try:
                        if a.site_id and a.site_id.id == site_id and a.is_empty and a.rubro_code:
                            ack_codes_any.add(a.rubro_code)
                    except Exception:
                        continue

            def state_for_code(code):
                return 1 if code in line_codes_site else (2 if code in ack_codes_any else 0)

            rec.rubro_state_mano_obra                 = state_for_code('mano_obra')
            rec.rubro_state_uniforme                  = state_for_code('uniforme')
            rec.rubro_state_epp                       = state_for_code('epp')
            rec.rubro_state_epp_alturas               = state_for_code('epp_alturas')
            rec.rubro_state_equipo_especial_limpieza  = state_for_code('equipo_especial_limpieza')
            rec.rubro_state_comunicacion_computo      = state_for_code('comunicacion_computo')
            rec.rubro_state_herramienta_menor_jardineria = state_for_code('herramienta_menor_jardineria')
            rec.rubro_state_material_limpieza         = state_for_code('material_limpieza')
            rec.rubro_state_perfil_medico             = state_for_code('perfil_medico')
            rec.rubro_state_maquinaria_limpieza       = state_for_code('maquinaria_limpieza')
            rec.rubro_state_maquinaria_jardineria     = state_for_code('maquinaria_jardineria')
            rec.rubro_state_fertilizantes_tierra_lama = state_for_code('fertilizantes_tierra_lama')
            rec.rubro_state_consumibles_jardineria    = state_for_code('consumibles_jardineria')
            rec.rubro_state_capacitacion              = state_for_code('capacitacion')

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

        for rec in self:
            site_id = _site_for_compute(rec)

            # Conjuntos de códigos por servicio con líneas guardadas en el sitio
            line_codes_by_srv = {'jardineria': set(), 'limpieza': set()}
            if rec.line_ids:
                for l in rec.line_ids:
                    try:
                        # Incluir también líneas no guardadas para que el pintado sea inmediato
                        # al alternar de servicio sin necesidad de visitar cada pestaña.
                        if site_id and (not l.site_id or l.site_id.id != site_id):
                            continue
                        code = getattr(l, 'rubro_code', False) or getattr(l.rubro_id, 'code', False)
                        st = getattr(l, 'service_type', False)
                        if code and st in line_codes_by_srv:
                            line_codes_by_srv[st].add(code)
                    except Exception:
                        continue

            # Conjuntos de ACKs por servicio en el sitio
            ack_codes_by_srv = {'jardineria': set(), 'limpieza': set()}
            if site_id and rec.ack_ids:
                for a in rec.ack_ids:
                    try:
                        if a.site_id and a.site_id.id == site_id and a.is_empty and a.service_type in ack_codes_by_srv and a.rubro_code:
                            ack_codes_by_srv[a.service_type].add(a.rubro_code)
                    except Exception:
                        continue

            def state_for_service(code, service_type):
                has_lines = code in line_codes_by_srv.get(service_type, set())
                has_ack = code in ack_codes_by_srv.get(service_type, set())
                return 1 if has_lines else (2 if has_ack else 0)

            # Jardinería
            rec.rubro_state_mano_obra_jard                 = state_for_service('mano_obra', 'jardineria')
            rec.rubro_state_uniforme_jard                  = state_for_service('uniforme', 'jardineria')
            rec.rubro_state_epp_jard                       = state_for_service('epp', 'jardineria')
            rec.rubro_state_epp_alturas_jard               = state_for_service('epp_alturas', 'jardineria')
            rec.rubro_state_equipo_especial_limpieza_jard  = state_for_service('equipo_especial_limpieza', 'jardineria')
            rec.rubro_state_comunicacion_computo_jard      = state_for_service('comunicacion_computo', 'jardineria')
            rec.rubro_state_herramienta_menor_jardineria_jard = state_for_service('herramienta_menor_jardineria', 'jardineria')
            rec.rubro_state_material_limpieza_jard         = state_for_service('material_limpieza', 'jardineria')
            rec.rubro_state_perfil_medico_jard             = state_for_service('perfil_medico', 'jardineria')
            rec.rubro_state_maquinaria_limpieza_jard       = state_for_service('maquinaria_limpieza', 'jardineria')
            rec.rubro_state_maquinaria_jardineria_jard     = state_for_service('maquinaria_jardineria', 'jardineria')
            rec.rubro_state_fertilizantes_tierra_lama_jard = state_for_service('fertilizantes_tierra_lama', 'jardineria')
            rec.rubro_state_consumibles_jardineria_jard    = state_for_service('consumibles_jardineria', 'jardineria')
            rec.rubro_state_capacitacion_jard              = state_for_service('capacitacion', 'jardineria')

            # Limpieza
            rec.rubro_state_mano_obra_limp                 = state_for_service('mano_obra', 'limpieza')
            rec.rubro_state_uniforme_limp                  = state_for_service('uniforme', 'limpieza')
            rec.rubro_state_epp_limp                       = state_for_service('epp', 'limpieza')
            rec.rubro_state_epp_alturas_limp               = state_for_service('epp_alturas', 'limpieza')
            rec.rubro_state_equipo_especial_limpieza_limp  = state_for_service('equipo_especial_limpieza', 'limpieza')
            rec.rubro_state_comunicacion_computo_limp      = state_for_service('comunicacion_computo', 'limpieza')
            rec.rubro_state_herramienta_menor_jardineria_limp = state_for_service('herramienta_menor_jardineria', 'limpieza')
            rec.rubro_state_material_limpieza_limp         = state_for_service('material_limpieza', 'limpieza')
            rec.rubro_state_perfil_medico_limp             = state_for_service('perfil_medico', 'limpieza')
            rec.rubro_state_maquinaria_limpieza_limp       = state_for_service('maquinaria_limpieza', 'limpieza')
            rec.rubro_state_maquinaria_jardineria_limp     = state_for_service('maquinaria_jardineria', 'limpieza')
            rec.rubro_state_fertilizantes_tierra_lama_limp = state_for_service('fertilizantes_tierra_lama', 'limpieza')
            rec.rubro_state_consumibles_jardineria_limp    = state_for_service('consumibles_jardineria', 'limpieza')
            rec.rubro_state_capacitacion_limp              = state_for_service('capacitacion', 'limpieza')

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

            # Usar sudo() y context para evitar disparar constraints innecesarios
            # al crear/modificar ACKs (evita error de validación de unicidad en cotización)
            AckModel = self.env['ccn.service.quote.ack'].sudo().with_context(skip_quote_constraints=True)

            ack = AckModel.search([
                ('quote_id', '=', rec.id),
                ('site_id', '=', site.id if site else False),
                ('service_type', '=', rec.current_service_type),
                ('rubro_code', '=', rubro_code),
            ], limit=1)
            if ack:
                ack.write({'is_empty': bool(value)})
            else:
                AckModel.create({
                    'quote_id': rec.id,
                    'site_id': site.id if site else False,
                    'service_type': rec.current_service_type,
                    'rubro_code': rubro_code,
                    'is_empty': bool(value),
                })

    def action_mark_rubro_empty(self):
        self.ensure_one()
        # Para registros nuevos, retornar True para que el JS lo maneje optimistamente
        # (el ACK solo se guardará en BD cuando el usuario guarde la cotización)
        if not self.id or isinstance(self.id, models.NewId):
            return True

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
        # Puede llamarse sin registro (desde control en lista vacía)
        # En ese caso, obtener quote_id del contexto
        ctx = dict(self.env.context or {})

        if self:
            self.ensure_one()
            quote_id = self.id
            site_id = self.current_site_id.id if self.current_site_id else False
            service_type = self.current_service_type or False
        else:
            # Si self está vacío, obtener del contexto
            quote_id = ctx.get('default_quote_id') or ctx.get('quote_id')
            if not quote_id:
                return False
            quote = self.env['ccn.service.quote'].browse(quote_id)
            site_id = quote.current_site_id.id if quote.current_site_id else False
            service_type = quote.current_service_type or False

        ctx.update({
            'active_model': 'ccn.service.quote',
            'active_id': quote_id,
            'quote_id': quote_id,
            'site_id': site_id,
            'service_type': service_type,
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

    def _make_unique_name(self, partner_id, desired_name):
        """Return a name unique per partner by appending a numeric suffix if needed."""
        base = (desired_name or '').strip() or self.env._('Nueva Cotización')
        name = base
        i = 1
        while self.search_count([('partner_id', '=', partner_id), ('name', '=', name)]):
            i += 1
            name = f"{base} ({i})"
        return name

    @api.model_create_multi
    def create(self, vals_list):
        # Asegurar sitio por defecto y nombre único por cliente para evitar fallos de constraint
        for vals in vals_list:
            if not vals.get('site_ids'):
                vals['site_ids'] = self._default_site_ids()
            try:
                pid = vals.get('partner_id') or None
                nm = vals.get('name')
                if pid:
                    vals['name'] = self._make_unique_name(pid, nm)
            except Exception:
                # En caso de no poder garantizar unicidad aquí, dejar que el constraint actúe
                pass

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
        # Evitar disparar constraint SQL de unicidad cuando los valores no cambian
        # Esto previene errores al crear/modificar ACKs que actualizan ack_ids
        if vals and not self.env.context.get('skip_uniqueness_filter'):
            # Filtrar campos que disparan el constraint si no han cambiado
            if len(self) == 1 and ('partner_id' in vals or 'name' in vals):
                if 'partner_id' in vals and vals['partner_id'] == self.partner_id.id:
                    vals = dict(vals)
                    del vals['partner_id']
                if 'name' in vals and vals['name'] == self.name:
                    vals = dict(vals)
                    del vals['name']
                # Si intentan escribir un nombre que colisiona, ajustar automáticamente
                if 'name' in vals and 'partner_id' not in vals:
                    # asegurar que el nuevo nombre sea único para el partner actual
                    vals = dict(vals)
                    vals['name'] = self._make_unique_name(self.partner_id.id, vals['name'])
                elif 'partner_id' in vals and 'name' not in vals:
                    # mover de partner: garantizar nombre único en el nuevo partner
                    vals = dict(vals)
                    vals['name'] = self._make_unique_name(vals['partner_id'], self.name)
                elif 'partner_id' in vals and 'name' in vals:
                    vals = dict(vals)
                    vals['name'] = self._make_unique_name(vals['partner_id'], vals['name'])

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

    # ============================================
    # FLUJO DE AUTORIZACIÓN
    # ============================================

    @api.depends('line_ids', 'line_ids.service_type', 'line_ids.rubro_code',
                 'ack_ids', 'ack_ids.service_type', 'ack_ids.rubro_code', 'ack_ids.is_empty', 'state')
    def _compute_can_request_authorization(self):
        """
        Verifica si todos los tabs activos están completos (verde o ámbar).
        Un servicio se considera inactivo si TODOS sus rubros están en rojo.
        """
        for rec in self:
            _logger.info(f"[AUTH] Computing authorization for quote {rec.id} (state={rec.state})")

            # Solo en estado borrador se puede solicitar autorización
            if rec.state != 'draft':
                rec.can_request_authorization = False
                _logger.info(f"[AUTH] Quote {rec.id}: state is not draft, can_request=False")
                continue

            # Obtener servicios activos con al menos una línea o ACK
            servicios_activos = set()
            for line in rec.line_ids:
                if line.service_type:
                    servicios_activos.add(line.service_type)
            for ack in rec.ack_ids:
                if ack.service_type and ack.is_empty:
                    servicios_activos.add(ack.service_type)

            _logger.info(f"[AUTH] Quote {rec.id}: servicios_activos={servicios_activos}")

            # Si no hay servicios activos, no se puede solicitar autorización
            if not servicios_activos:
                rec.can_request_authorization = False
                _logger.info(f"[AUTH] Quote {rec.id}: no active services, can_request=False")
                continue

            # Verificar que cada servicio activo tenga todos sus rubros completos
            # Un rubro está completo si tiene líneas (verde) o ACK (ámbar)
            all_complete = True
            for servicio in servicios_activos:
                # Obtener rubros con datos para este servicio
                rubros_con_lineas = set()
                rubros_con_ack = set()

                for line in rec.line_ids.filtered(lambda l: l.service_type == servicio):
                    if line.rubro_code:
                        rubros_con_lineas.add(line.rubro_code)

                for ack in rec.ack_ids.filtered(lambda a: a.service_type == servicio and a.is_empty):
                    if ack.rubro_code:
                        rubros_con_ack.add(ack.rubro_code)

                # Rubros que aplican para este tipo de servicio
                rubros_requeridos = RUBROS_POR_SERVICIO.get(servicio, set())

                # Si no hay rubros definidos para este servicio, usar todos
                if not rubros_requeridos:
                    rubros_requeridos = {code for code, _ in RUBRO_CODES}

                # Verificar si hay al menos un rubro sin completar (sin líneas ni ACK)
                rubros_completos = rubros_con_lineas | rubros_con_ack
                rubros_incompletos = rubros_requeridos - rubros_completos

                _logger.info(f"[AUTH] Quote {rec.id}, servicio {servicio}: "
                           f"rubros_requeridos={rubros_requeridos}, "
                           f"rubros_con_lineas={rubros_con_lineas}, "
                           f"rubros_con_ack={rubros_con_ack}, "
                           f"rubros_incompletos={rubros_incompletos}")

                # Si hay rubros incompletos, este servicio no está completo
                if rubros_incompletos:
                    all_complete = False
                    _logger.info(f"[AUTH] Quote {rec.id}, servicio {servicio}: INCOMPLETO")
                    break

            rec.can_request_authorization = all_complete
            _logger.info(f"[AUTH] Quote {rec.id}: FINAL can_request_authorization={all_complete}")

    @api.depends()
    def _compute_is_authorizer(self):
        """Verifica si el usuario actual pertenece al grupo de autorizadores"""
        authorizer_group = self.env.ref('ccn_service_quote.group_ccn_quote_authorizer', raise_if_not_found=False)
        for rec in self:
            rec.is_authorizer = authorizer_group and self.env.user in authorizer_group.users

    def action_request_authorization(self):
        """Solicita autorización de la cotización"""
        self.ensure_one()

        if self.state != 'draft':
            raise UserError(_('Solo se pueden solicitar autorización de cotizaciones en estado Borrador.'))

        if not self.can_request_authorization:
            raise UserError(_('No se puede solicitar autorización. Asegúrese de que todos los servicios activos tengan todos sus rubros completos.'))

        # Cambiar estado a pendiente
        self.write({'state': 'pending'})

        # Enviar notificación a autorizadores
        self._notify_authorizers()

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Autorización solicitada'),
                'message': _('La cotización ha sido enviada para autorización.'),
                'type': 'success',
                'sticky': False,
            }
        }

    def action_authorize(self):
        """Autoriza la cotización (solo para autorizadores)"""
        self.ensure_one()

        # Verificar que el usuario sea autorizador
        if not self.is_authorizer:
            raise UserError(_('No tiene permisos para autorizar cotizaciones.'))

        if self.state != 'pending':
            raise UserError(_('Solo se pueden autorizar cotizaciones en estado Pendiente.'))

        # Cambiar estado a autorizado
        self.write({'state': 'authorized'})

        # Notificar al creador
        self._notify_authorization_complete()

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Cotización autorizada'),
                'message': _('La cotización ha sido autorizada exitosamente.'),
                'type': 'success',
                'sticky': False,
            }
        }

    def _notify_authorizers(self):
        """Envía notificación a los usuarios autorizadores"""
        self.ensure_one()
        authorizer_group = self.env.ref('ccn_service_quote.group_ccn_quote_authorizer', raise_if_not_found=False)

        if not authorizer_group:
            return

        # Obtener usuarios autorizadores
        authorizers = authorizer_group.users

        if not authorizers:
            return

        # Crear mensaje en el chatter
        message = _(
            'La cotización <b>%(quote_name)s</b> para el cliente <b>%(partner_name)s</b> '
            'requiere autorización.',
            quote_name=self.name,
            partner_name=self.partner_id.name,
        )

        self.message_post(
            body=message,
            subject=_('Solicitud de autorización de cotización'),
            message_type='notification',
            partner_ids=authorizers.partner_id.ids,
            subtype_xmlid='mail.mt_comment',
        )

    def _notify_authorization_complete(self):
        """Notifica al creador que la cotización fue autorizada"""
        self.ensure_one()

        # Notificar al creador del registro
        if self.create_uid:
            message = _(
                'La cotización <b>%(quote_name)s</b> para el cliente <b>%(partner_name)s</b> '
                'ha sido autorizada.',
                quote_name=self.name,
                partner_name=self.partner_id.name,
            )

            self.message_post(
                body=message,
                subject=_('Cotización autorizada'),
                message_type='notification',
                partner_ids=[self.create_uid.partner_id.id] if self.create_uid.partner_id else [],
                subtype_xmlid='mail.mt_comment',
            )


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
    def _frequency_selection(self):
        base = [
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
        ]
        if self.env.context.get('ccn_mo_freq_only'):
            return [
                ('weekly', 'Semanal'),
                ('biweekly', 'Quincenal'),
                ('monthly', 'Mensual'),
            ]
        return base

    frequency = fields.Selection(
        selection=_frequency_selection,
        string='Frecuencia', default='monthly', required=True
    )

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

    # Asegurar opciones de frecuencia válidas por rubro
    @api.onchange('rubro_id', 'rubro_code', 'frequency')
    def _onchange_frequency_by_rubro(self):
        for line in self:
            code = (line.rubro_code or '').strip()
            if code == 'mano_obra':
                allowed = {'weekly', 'biweekly', 'monthly'}
                if line.frequency not in allowed:
                    line.frequency = 'monthly'

    @api.constrains('rubro_id', 'rubro_code', 'frequency')
    def _check_frequency_by_rubro(self):
        from odoo.exceptions import ValidationError
        for line in self:
            code = (line.rubro_code or '').strip()
            if code == 'mano_obra':
                allowed = {'weekly', 'biweekly', 'monthly'}
                if line.frequency not in allowed:
                    raise ValidationError(
                        _("En Mano de Obra la frecuencia debe ser Semanal, Quincenal o Mensual.")
                    )

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

    def write(self, vals):
        """Override write para forzar recálculo cuando cambian campos relevantes."""
        result = super().write(vals)
        # Forzar recálculo de la cotización padre si cambian campos que afectan estados
        if any(field in vals for field in ['site_id', 'service_type', 'rubro_id', 'rubro_code']):
            quotes = self.mapped('quote_id')
            if quotes:
                # Forzar recálculo inmediato
                quotes.modified(['line_ids'])
        return result

    def unlink(self):
        """Override unlink para forzar recálculo después de eliminar líneas."""
        quotes = self.mapped('quote_id')
        result = super().unlink()
        if quotes:
            # Forzar recálculo inmediato después de eliminar
            quotes.modified(['line_ids'])
        return result
