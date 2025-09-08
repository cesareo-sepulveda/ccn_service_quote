# -*- coding: utf-8 -*-
{
    "name": "CCN Service Quote",
    "summary": "Wizard para cotizar servicios CCN",
    "version": "18.0.9.1.21",
    "author": "Witann Technologies",
    "license": "LGPL-3",
    "category": "Sales/Sales",
    "depends": ["base","product","sale","account"],
    "data": [
        "data/ccn_quote_attach_xmlid.xml",
        "views/ccn_quote_form_scope.xml",
        "views/ccn_quote_line_inline_product_domain.xml",
        "views/quote_site_fix.xml",
        "security/ir.model.access.csv",
        'data/rubro_data.xml',
        "views/rubro_views.xml",
        'views/quote_line_list_inline.xml',
        "views/quote_views.xml",
        "views/pick_quote_wizard.xml",
        "views/quote_actions.xml", 
        "views/ccn_menus.xml",
        "views/sale_order_button.xml",
        "views/product_template_ccn.xml",
        'data/ccn_rubros.xml',
        'views/site_views.xml',
        'views/cleanup_disable_legacy_views.xml',
    ],
    "assets": {
        "web.assets_backend": [
            "ccn_service_quote/static/src/js/quote_tab_badges.js",
            "ccn_service_quote/static/src/scss/quote_tabs.scss",
        ]
    },
    "installable": True,
    "application": True,
    "auto_install": False,
}
