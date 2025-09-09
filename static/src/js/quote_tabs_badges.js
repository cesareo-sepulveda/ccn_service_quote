/** @odoo-module **/
import { registry } from "@web/core/registry";

// Si tienes checkboxes de "ack" por rubro, usa el name field: ack_<page>_empty
function readAckForPage(panelEl) {
  const panelName = panelEl.getAttribute("name") || "";
  const ackField = `ack_${panelName.replace("page_", "")}_empty`;
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

function applyTabStatuses() {
  document.querySelectorAll(".o_form_view.ccn-quote").forEach((form) => {
    const notebook = form.querySelector(".o_notebook");
    if (!notebook) {
      return;
    }
    notebook.querySelectorAll("ul.nav-tabs > li").forEach((tab) => {
      const link = tab.querySelector(".nav-link");
      if (!link) {
        return;
      }
      const target = link.getAttribute("data-bs-target") || link.getAttribute("href");
      if (!target) {
        return;
      }
      const panel = notebook.querySelector(target);
      if (!panel) {
        return;
      }

      const count = countRows(panel);
      const ack = readAckForPage(panel);

      tab.classList.remove("ccn-tab-empty", "ccn-tab-skip", "ccn-tab-complete");
      if (count > 0) {
        tab.classList.add("ccn-tab-complete");
      } else if (ack) {
        tab.classList.add("ccn-tab-skip");
      } else {
        tab.classList.add("ccn-tab-empty");
      }
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
