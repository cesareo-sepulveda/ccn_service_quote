/** @odoo-module **/
import { registry } from "@web/core/registry";
import { onMounted, onPatched } from "@odoo/owl";

const PAGES = [
  "page_mano_obra",
  "page_uniforme",
  "page_epp",
  "page_epp_alturas",
  "page_equipo_especial_limpieza",
  "page_comunicacion_computo",
  "page_herr_menor_jardineria",
  "page_material_limpieza",
  "page_perfil_medico",
  "page_maquinaria_limpieza",
  "page_maquinaria_jardineria",
  "page_fertilizantes_tierra_lama",
  "page_consumibles_jardineria",
  "page_capacitacion",
];

// Si tienes checkboxes de "ack" por rubro, usa el name field: ack_<page>_empty
function readAckForPage(panelEl, pageName) {
  const ackField = `ack_${pageName.replace("page_", "")}_empty`;
  const el = panelEl.querySelector(
    `.o_field_widget[name="${ackField}"] input[type="checkbox"], [name="${ackField}"] input[type="checkbox"]`
  );
  return el ? !!el.checked : false;
}

function countRows(panelEl) {
  // Cuenta filas de la lista interna, evita la fila "Agregar un elemento"
  const rows = panelEl.querySelectorAll(".o_list_view tbody tr:not(.o_list_record_add)");
  return rows.length || 0;
}

function linkForPanel(form, panelEl) {
  const id = panelEl.getAttribute("id");
  if (!id) return null;
  return form.querySelector(`.o_notebook .nav-link[data-bs-target="#${id}"], .o_notebook .nav-link[href="#${id}"]`);
}

function applyTabStatuses() {
  document.querySelectorAll(".o_form_view.ccn-quote").forEach((form) => {
    PAGES.forEach((pageName) => {
      const panel = form.querySelector(`.o_notebook .o_notebook_page[name="${pageName}"]`);
      if (!panel) return;
      const link = linkForPanel(form, panel);
      if (!link) return;

      const count = countRows(panel);
      const ack = readAckForPage(panel, pageName);

      link.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled");
      if (count > 0)       link.classList.add("ccn-status-filled");
      else if (ack)        link.classList.add("ccn-status-ack");
      else                 link.classList.add("ccn-status-empty");
    });
  });
}

const service = {
  name: "ccn_quote_tab_colors",
  start() {
    onMounted(() => applyTabStatuses());
    onPatched(() => applyTabStatuses());
    document.body.addEventListener("change", (ev) => {
      if (ev.target.closest(".o_form_view.ccn-quote")) applyTabStatuses();
    });
  },
};
registry.category("services").add("ccn_quote_tab_colors", service);
