# -*- coding: utf-8 -*-
{
    "name": "Cotizador Especial CCN",
    "summary": "Wizard para cotizar servicios CCN",
    "version": "18.0.9.4.32",
    "author": "Witann Technologies",
    "license": "LGPL-3",
    "category": "Sales/Sales",
    "depends": ["base", "web", "product", "sale", "account"],
    "data": [
        # Seguridad siempre primero
        "security/ir.model.access.csv",

        # Limpiezas / fixes de arranque
        "data/cleanup_views.xml",

        # 🔴 IMPORTANTE: cargar PRIMERO la vista base de líneas inline
        "views/quote_line_list_inline.xml",

        # Luego cualquier vista que herede/ajuste esa base
        "views/ccn_quote_line_inline_product_domain.xml",

        # Vistas principales
        "views/quote_views.xml",
        "views/ccn_quote_form_scope.xml",
        "views/quote_site_fix.xml",

        # Datos y catálogos
        "data/rubro_data.xml",
        "views/rubro_views.xml",
        "data/ccn_rubros.xml",

        # Otras vistas/acciones/menus
        "views/pick_quote_wizard.xml",
        "views/quote_actions.xml",
        "views/ccn_menus.xml",
        "views/sale_order_button.xml",
        "views/product_template_ccn.xml",
        "views/site_views.xml",
        "views/quote_tabs_status.xml",
        "views/cleanup_disable_legacy_views.xml",
        "views/res_partner_views.xml",

        # Migración / normalización (idempotente)
        "data/migrate_fix_general.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "ccn_service_quote/static/src/js/quote_tabs_badges.js",
            "ccn_service_quote/static/src/scss/quote_tabs.scss",
        ]
    },
    "installable": True,
    "application": True,
    "auto_install": False,
    "post_init_hook": "post_init_hook",
}
