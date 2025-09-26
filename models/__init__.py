"""Load all models for the CCN service quote module."""

from . import (
    service_quote,
    site,
    # Bucket por Rubro (Sitio × Tipo × Rubro)
    scope_rubro,
    # Migración para rellenar bucket_id en líneas existentes
    migrate_fill_buckets,
    ack,
    add_package_wizard,
    patch_rubro_code,
    product,
    quote_line_enhancements,
    quote_line_extend,
    quote_line_related,
    quote_line_tax,
    quote_partner_user_fields,
    res_partner,
    rubro,
    rubro_flag,
    sale_order,
    service_package,
    pick_quote_wizard
)
