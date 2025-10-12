# -*- coding: utf-8 -*-
{
    "name": "Cotizador Especial CCN",
    "summary": "Wizard para cotizar servicios CCN",
    "version": "18.0.9.8.81",
    "author": "Witann Technologies",
    "license": "LGPL-3",
    "category": "Sales/Sales",
    "depends": ["base", "web", "product", "sale", "account"],
    "data": [
        "security/ir.model.access.csv",
        "data/cleanup_views.xml",
        "views/site_views.xml",
        "views/quote_views.xml",
        "views/ccn_quote_form_scope.xml",
        "views/quote_site_fix.xml",
        "views/quote_line_list_inline.xml",
        "views/ccn_quote_line_inline_product_domain.xml",
        "views/quote_line_list_inline_mano_obra.xml",
        "data/rubro_data.xml",
        "views/rubro_views.xml",
        "views/pick_quote_wizard.xml",
        "views/quote_actions.xml",
        "views/ccn_menus.xml",
        "views/sale_order_button.xml",
        "views/product_template_ccn.xml",
        # "data/ccn_rubros.xml",  # Comentado temporalmente - los rubros ya existen en BD
        "views/quote_tabs_status.xml",
        "views/ccn_service_quote_states_inherit.xml",
        "views/cleanup_disable_legacy_views.xml",
        "views/res_partner_views.xml",
        "data/migrate_fix_general.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "ccn_service_quote/static/src/js/quote_notebook_v3.js",
            "ccn_service_quote/static/src/js/quote_tabs_badges.js",
            # "ccn_service_quote/static/src/js/quote_tabs_color_map_v2.js",  # DESACTIVADO - conflicto con badges.js
            "ccn_service_quote/static/src/js/catalog_direct_select.js",
            "ccn_service_quote/static/src/scss/quote_tabs.scss",
            "ccn_service_quote/static/src/scss/catalog_ui.scss",
        ]
    },
    "installable": True,
    "application": True,
    "auto_install": False,
    "post_init_hook": "post_init_hook",
}
