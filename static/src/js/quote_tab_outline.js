/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { onMounted } from "@odoo/owl";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        // Agregar observer para detectar cambios de tab
        onMounted(() => {
            if (this.props.resModel === 'ccn.service.quote') {
                this._addTabOutlineObserver();
            }
        });
    },

    _addTabOutlineObserver() {
        const form = document.querySelector('.ccn-quote');
        if (!form) return;

        const navTabs = form.querySelector('.o_notebook .nav-tabs');
        if (!navTabs) return;

        // Observer para detectar cambios de clase 'active'
        const observer = new MutationObserver(() => {
            this._updateTabOutlines(navTabs);
        });

        // Observar cambios en los <li>
        navTabs.querySelectorAll('li').forEach(li => {
            observer.observe(li, {
                attributes: true,
                attributeFilter: ['class']
            });
        });

        // Aplicar outline inicial
        this._updateTabOutlines(navTabs);
    },

    _updateTabOutlines(navTabs) {
        const chevronWidth = 16; // $ccn-tab-chevron

        navTabs.querySelectorAll('li').forEach((li, index) => {
            // Remover outline previo si existe
            const existingOutline = li.querySelector('.ccn-tab-outline');
            if (existingOutline) {
                existingOutline.remove();
            }

            // Solo agregar outline a tabs activos (excepto el primero - placeholder)
            if (index === 0 || !li.classList.contains('active')) {
                return;
            }

            const navLink = li.querySelector('.nav-link');
            if (!navLink) return;

            // Crear SVG para el outline
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('ccn-tab-outline');
            svg.style.position = 'absolute';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '100'; // por encima del tab

            // Obtener dimensiones del navLink
            const rect = navLink.getBoundingClientRect();
            const width = navLink.offsetWidth;
            const height = navLink.offsetHeight;

            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.style.left = navLink.style.marginLeft || `calc(-${chevronWidth}px + 6px)`;
            svg.style.top = '0';
            svg.style.width = `${width}px`;
            svg.style.height = `${height}px`;

            // Crear el path del outline (chevron con muesca izquierda)
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const points = `0,0 ${width - chevronWidth},0 ${width},${height/2} ${width - chevronWidth},${height} 0,${height} ${chevronWidth},${height/2}`;
            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', 'none');
            polygon.setAttribute('stroke', '#000');
            polygon.setAttribute('stroke-width', '3');

            svg.appendChild(polygon);
            li.appendChild(svg);
        });
    }
});
