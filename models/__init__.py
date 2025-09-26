# -*- coding: utf-8 -*-
from . import (
    service_quote,      # única fuente de ServiceQuote y Line
    site,               # sitios con indicadores
    ack,                # modelo de ACK por rubro (usa campo 'ack')
    product,            # extensión product.template/product.product (ccn_rubro_ids, ccn_exclude_from_quote)
    res_partner,        # si tienes extensiones al partner
    rubro,              # catálogo de rubros
    rubro_flag,         # si lo usas
    sale_order,         # si lo usas
    service_package,    # si lo usas
    add_package_wizard, # si lo usas
    patch_rubro_code,   # si lo usas
    pick_quote_wizard   # si lo usas
)
