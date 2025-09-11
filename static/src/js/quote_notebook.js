/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { _t } from "@web/core/l10n/translation";

function normalizeCode(code) {
    switch (code) {
        case "herr_menor_jardineria":
            return "herramienta_menor_jardineria";
        default:
            return code;
    }
}

export function initQuoteTabs(controller) {
    if (!controller.model || controller.model.name !== "ccn.service.quote") {
        return;
    }
    const notebook = controller.el.querySelector("div.o_notebook");
    if (!notebook) {
        return;
    }
    const links = notebook.querySelectorAll('.nav-tabs .nav-link[name^="page_"]');
    // Publicar mapa de estados en múltiples nodos para facilitar lectura y para consumo
    // del servicio de badges. El mapa resultante se serializa una vez y se expone en
    // distintos nodos para que otros componentes puedan leerlo sin recalcularlo.
    const states = {};
    links.forEach((a) => {
        const m = (a.getAttribute('name') || '').match(/^page_(.+)$/);
        if (!m) return;
        const raw = m[1];
        const code = normalizeCode(raw);
        const field = `rubro_state_${code}`;
        const val = controller.model.root && controller.model.root.data ? controller.model.root.data[field] : null;
        if (val) states[code] = val;
    });
    const jsonStates = JSON.stringify(states);
    try {
        controller.el.dataset.ccnStates = jsonStates;
        const wrapper = controller.el.closest ? (controller.el.closest('.o_form_view') || controller.el) : controller.el;
        if (wrapper) wrapper.dataset.ccnStates = jsonStates;
        const innerForm = controller.el.querySelector && controller.el.querySelector('form');
        if (innerForm) innerForm.dataset.ccnStates = jsonStates;
    } catch(e) {}
    links.forEach((a) => {
        const m = (a.getAttribute('name') || '').match(/^page_(.+)$/);
        if (!m) return;
        const raw = m[1];
        const code = normalizeCode(raw);
        const cont = notebook.querySelector(`[name="line_${code}_ids"]`);
        if (!cont) return; // pane aún no montado
        const pane = cont.closest('.tab-pane') || notebook;
        if (pane.querySelector('.ccn-skip')) return;

        // Estado inicial según campos rubro_state_*
        const stateField = `rubro_state_${code}`;
        const state = controller.model.root && controller.model.root.data ? controller.model.root.data[stateField] : null;
        if (state === 'yellow') {
            pane.dataset.ccnAck = '1';
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary ccn-skip';
        btn.textContent = pane.dataset.ccnAck === '1' ? _t('Quitar No Aplica') : _t('No Aplica');
        pane.prepend(btn);
        btn.addEventListener('click', async () => {
            const ack = pane.dataset.ccnAck === '1';
            const method = ack ? 'action_unmark_rubro_empty' : 'action_mark_rubro_empty';
            const orm = controller.model.orm || controller.orm;
            await orm.call(
                'ccn.service.quote',
                method,
                [[controller.model.root.data.id]],
                { context: { rubro_code: code } }
            );
            pane.dataset.ccnAck = ack ? '0' : '1';
            btn.textContent = pane.dataset.ccnAck === '1' ? _t('Quitar No Aplica') : _t('No Aplica');
            const stateInput = controller.el.querySelector(`[name="rubro_state_${code}"]`);
            if (stateInput) {
                stateInput.setAttribute('value', pane.dataset.ccnAck === '1' ? 'yellow' : 'red');
                stateInput.value = pane.dataset.ccnAck === '1' ? 'yellow' : 'red';
            }
            // Refrescar dataset de estados
            try {
                const map = JSON.parse(controller.el.dataset.ccnStates || '{}');
                map[code] = pane.dataset.ccnAck === '1' ? 'yellow' : 'red';
                controller.el.dataset.ccnStates = JSON.stringify(map);
            } catch(e) {}
            if (window.__ccnTabsDebug && window.__ccnTabsDebug.applyAll) {
                window.__ccnTabsDebug.applyAll();
            }
        });
    });
    if (window.__ccnTabsDebug && window.__ccnTabsDebug.applyAll) {
        window.__ccnTabsDebug.applyAll();
    }
}

patch(FormController.prototype, {
    patchName: "ccn_quote_notebook",
    async onMounted() {
        if (this._super) {
            await this._super(...arguments);
        }
        initQuoteTabs(this);
    },
    async onWillUpdateProps() {
        if (this._super) {
            await this._super(...arguments);
        }
        initQuoteTabs(this);
    },
});
