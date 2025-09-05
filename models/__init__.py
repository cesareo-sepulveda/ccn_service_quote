# -*- coding: utf-8 -*-

# 1) Modelos base que definen clases nuevas
from . import rubro          # define ccn.service.rubro
from . import service_quote          # define ccn.service.quote y ccn.service.quote.line

# 2) Extensiones a modelos estándar u otros helpers
from . import product        # añade campos a product.template
from . import sale_order     # lógica para inyectar lines a SO

# 3) Complementos/ajustes sobre líneas de quote
from . import quote_line   # onchange/domino de product por rubro
from . import quote_tabulador     # campo 'tabulador' y recálculo de price_unit_final
