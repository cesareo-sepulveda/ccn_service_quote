/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        // Monitorear cambios en el estado
        if (this.props.resModel === 'ccn.service.quote') {
            this.onRecordChanged = () => {
                const record = this.model.root;
                if (record && record.data.state === 'authorized') {
                    this.makeFieldsReadonly();
                }
            };
        }
    },

    makeFieldsReadonly() {
        // Forzar readonly en todos los campos cuando el estado es 'authorized'
        const record = this.model.root;
        if (record && record.data.state === 'authorized') {
            // Hacer readonly todos los campos excepto current_service_type y current_site_id (para navegación)
            // current_site_id se configura con options no_create en la vista para evitar agregar sitios
            Object.keys(record.fields).forEach(fieldName => {
                if (fieldName !== 'current_service_type' && fieldName !== 'current_site_id') {
                    const field = record.fields[fieldName];
                    if (field && !field.readonly) {
                        field.readonly = true;
                    }
                }
            });
        }
    }
});
