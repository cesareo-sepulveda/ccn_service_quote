# -*- coding: utf-8 -*-
"""Carga de modelos del módulo CCN Service Quote.

IMPORTANTE:
- Mantén aquí únicamente los módulos que EXISTEN en tu carpeta models/.
- Si más adelante agregas/quitas archivos .py, actualiza esta lista.
"""

from . import service_quote          # cotización + líneas (tu implementación actual)
from . import site                   # sitios de cotización
from . import ack                    # ACK "no aplica" por sitio/servicio/rubro

# Extensiones que normalmente sí existen en tu repo:
from . import product                # campos CCN en product/product.template
from . import res_partner            # extensiones en partner
from . import rubro                  # catálogo de rubros
from . import rubro_flag             # flags/marcadores de rubro
from . import sale_order             # integración con pedidos de venta
from . import service_package        # paquetes de servicio
from . import add_package_wizard     # wizard para añadir paquetes
from . import pick_quote_wizard      # wizard para seleccionar cotización

# Defaults/seguridad al crear líneas: completa quote/site/tipo/rubro desde el contexto.
# Mantén este import porque el archivo existe en tu repo.
from . import line_defaults

# ⚠️ No importes módulos que no tengas (ej.: quote_line_enhancements, quote_line_extend,
# quote_line_related, quote_line_tax, patch_rubro_code, etc.)
# Si alguno de los de arriba no existe en tu repo actual, elimínalo también de esta lista.
