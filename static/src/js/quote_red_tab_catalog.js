/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * Al hacer clic en un tab rojo (ccn-status-empty),
 * abre automáticamente el catálogo para ese rubro
 */
patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        // Obtener el servicio de acciones
        this.actionService = useService("action");

        onMounted(() => {
            if (this.props.resModel === 'ccn.service.quote') {
                this._setupRedTabCatalogOpener();
            }
        });
    },

    _setupRedTabCatalogOpener() {
        const form = document.querySelector('.ccn-quote');
        if (!form) return;

        const navTabs = form.querySelector('.o_notebook .nav-tabs');
        if (!navTabs) return;

        // Agregar listener a todos los tabs
        navTabs.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link');
            if (!navLink) return;

            const li = navLink.closest('li');
            if (!li) return;

            // Solo actuar si el tab es rojo (empty) y NO es el placeholder
            if (li.classList.contains('ccn-status-empty') && !li.classList.contains('active')) {
                // Esperar a que el tab se active
                setTimeout(() => {
                    this._openCatalogForTab(navLink);
                }, 100);
            }
        });
    },

    _openCatalogForTab(navLink) {
        // Extraer el rubro_code del name del tab
        const tabName = navLink.getAttribute('name') || navLink.getAttribute('aria-controls') || '';
        const rubroCode = this._extractRubroCode(tabName);

        if (!rubroCode) return;

        // Llamar a la acción del servidor para abrir el catálogo
        this.model.orm.call(
            this.props.resModel,
            'action_open_catalog_wizard',
            [this.model.root.resId],
            {
                context: {
                    ...this.props.context,
                    rubro_code: rubroCode
                }
            }
        ).then((action) => {
            if (action && action.type === 'ir.actions.client') {
                this.actionService.doAction(action);
            }
        });
    },

    _extractRubroCode(tabName) {
        // Los tabs tienen names como "page_mano_obra", "page_uniforme", etc.
        // Extraer el código del rubro quitando el prefijo "page_"
        if (!tabName || !tabName.startsWith('page_')) return null;

        const code = tabName.replace('page_', '');

        // Mapeo de nombres de tabs a códigos de rubro
        const rubroMap = {
            'mano_obra': 'mano_obra',
            'uniforme': 'uniforme',
            'epp': 'epp',
            'epp_alturas': 'epp_alturas',
            'equipo_especial_limpieza': 'equipo_especial_limpieza',
            'comunicacion_computo': 'comunicacion_computo',
            'herr_menor_jardineria': 'herramienta_menor_jardineria',
            'material_limpieza': 'material_limpieza',
            'perfil_medico': 'perfil_medico',
            'maquinaria_limpieza': 'maquinaria_limpieza',
            'maquinaria_jardineria': 'maquinaria_jardineria',
            'fertilizantes_tierra_lama': 'fertilizantes_tierra_lama',
            'consumibles_jardineria': 'consumibles_jardineria',
            'capacitacion': 'capacitacion'
        };

        return rubroMap[code] || code;
    }
});
