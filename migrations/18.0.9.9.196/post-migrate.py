# -*- coding: utf-8 -*-
"""
Migración: Corregir service_type en líneas de rubros específicos de jardinería/limpieza

Problema: Algunas líneas tienen service_type incorrecto basado en su rubro_code.
Por ejemplo, líneas de 'maquinaria_jardineria' con service_type='limpieza'.

Esta migración corrige automáticamente el service_type basándose en el rubro_code.
"""

def migrate(cr, version):
    """
    Corregir service_type de líneas basándose en su rubro_code.

    Rubros exclusivos de jardinería:
    - herramienta_menor_jardineria
    - maquinaria_jardineria
    - fertilizantes_tierra_lama
    - consumibles_jardineria
    - epp_alturas (principalmente jardinería)

    Rubros exclusivos de limpieza:
    - material_limpieza
    - maquinaria_limpieza
    - equipo_especial_limpieza
    """

    # Mapeo de rubro_code a service_type correcto
    rubro_to_service = {
        # Rubros exclusivos de jardinería
        'herramienta_menor_jardineria': 'jardineria',
        'maquinaria_jardineria': 'jardineria',
        'fertilizantes_tierra_lama': 'jardineria',
        'consumibles_jardineria': 'jardineria',
        'epp_alturas': 'jardineria',  # Principalmente para jardinería

        # Rubros exclusivos de limpieza
        'material_limpieza': 'limpieza',
        'maquinaria_limpieza': 'limpieza',
        'equipo_especial_limpieza': 'limpieza',
    }

    print("\n=== Iniciando corrección de service_type en líneas de cotización ===")

    for rubro_code, correct_service in rubro_to_service.items():
        # Buscar líneas con rubro_code correcto pero service_type incorrecto
        cr.execute("""
            UPDATE ccn_service_quote_line
            SET service_type = %s
            WHERE rubro_code = %s
              AND (service_type IS NULL OR service_type != %s)
            RETURNING id
        """, (correct_service, rubro_code, correct_service))

        updated_ids = [row[0] for row in cr.fetchall()]

        if updated_ids:
            print(f"  ✓ Corregidas {len(updated_ids)} líneas de '{rubro_code}' -> service_type='{correct_service}'")

    # También corregir líneas basándose en el code del rubro_id (por si rubro_code está vacío)
    cr.execute("""
        UPDATE ccn_service_quote_line AS l
        SET service_type = 'jardineria'
        FROM ccn_service_rubro AS r
        WHERE l.rubro_id = r.id
          AND r.code IN ('herramienta_menor_jardineria', 'maquinaria_jardineria',
                         'fertilizantes_tierra_lama', 'consumibles_jardineria', 'epp_alturas')
          AND (l.service_type IS NULL OR l.service_type != 'jardineria')
        RETURNING l.id
    """)

    jard_ids = [row[0] for row in cr.fetchall()]
    if jard_ids:
        print(f"  ✓ Corregidas {len(jard_ids)} líneas adicionales (por rubro_id) -> jardineria")

    cr.execute("""
        UPDATE ccn_service_quote_line AS l
        SET service_type = 'limpieza'
        FROM ccn_service_rubro AS r
        WHERE l.rubro_id = r.id
          AND r.code IN ('material_limpieza', 'maquinaria_limpieza', 'equipo_especial_limpieza')
          AND (l.service_type IS NULL OR l.service_type != 'limpieza')
        RETURNING l.id
    """)

    limp_ids = [row[0] for row in cr.fetchall()]
    if limp_ids:
        print(f"  ✓ Corregidas {len(limp_ids)} líneas adicionales (por rubro_id) -> limpieza")

    print("=== Corrección completada ===\n")
