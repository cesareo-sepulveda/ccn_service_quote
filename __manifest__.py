# -*- coding: utf-8 -*-
{
    "name": "CCN Service Quote",
    "summary": "Wizard para cotizar servicios CCN",
    "version": "18.0.8.8.5",
    "author": "Witann Technologies",
    "license": "LGPL-3",
    "category": "Sales/Sales",
    "depends": ["base","product","sale"],
    "data": [
        "security/ir.model.access.csv",
        "views/rubro_views.xml",
        "views/quote_views.xml",
        'views/quote_line_domain.xml',
        "views/pick_quote_wizard.xml",
        "views/quote_actions.xml", 
        "views/ccn_menus.xml",
        "views/sale_order_button.xml",
        "views/product_template_ccn.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
