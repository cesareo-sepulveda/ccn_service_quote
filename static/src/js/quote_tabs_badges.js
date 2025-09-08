/** @odoo-module **/
import { registry } from "@web/core/registry";

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
      const tab = link.closest("li");
      if (!tab) return;

      const count = countRows(panel);
      const ack = readAckForPage(panel, pageName);

      tab.classList.remove("ccn-tab-empty", "ccn-tab-skip", "ccn-tab-complete");
      if (count > 0)      tab.classList.add("ccn-tab-complete");
      else if (ack)       tab.classList.add("ccn-tab-skip");
      else                tab.classList.add("ccn-tab-empty");
    });
  });
}

const service = {
  name: "ccn_quote_tab_colors",
  start() {
    const observer = new MutationObserver(() => applyTabStatuses());
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.addEventListener("change", (ev) => {
      if (ev.target.closest(".o_form_view.ccn-quote")) applyTabStatuses();
    });
    applyTabStatuses();
  },
};
registry.category("services").add("ccn_quote_tab_colors", service);
