/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { onMounted } from "@odoo/owl";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        // Solo aplicar a cotizaciones CCN
        if (this.props.resModel === 'ccn.service.quote') {
            onMounted(() => {
                this.checkAndApplyReadonly();
            });
        }
    },

    checkAndApplyReadonly() {
        const record = this.model.root;
        if (record && record.data.state === 'authorized') {
            // Bloquear todos los campos excepto current_service_type
            const fieldComponents = this.__owl__.bdom.el.querySelectorAll('.o_field_widget');
            fieldComponents.forEach(fieldEl => {
                const fieldName = fieldEl.getAttribute('name');
                if (fieldName && fieldName !== 'current_service_type') {
                    // Deshabilitar completamente el campo
                    const inputs = fieldEl.querySelectorAll('input, select, textarea, button');
                    inputs.forEach(input => {
                        input.disabled = true;
                        input.style.pointerEvents = 'none';
                    });
                    // Bloquear el widget many2one
                    const many2oneInputs = fieldEl.querySelectorAll('.o_field_many2one input');
                    many2oneInputs.forEach(input => {
                        input.disabled = true;
                        input.readOnly = true;
                    });
                }
            });
        }
    }
});
