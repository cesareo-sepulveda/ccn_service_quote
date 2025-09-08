/** @odoo-module **/

import { registry } from "@web/core/registry";
import { onMounted, onPatched } from "@odoo/owl";

const PAGES = [
  { pageName: "page_mano_obra", countField: "mano_obra_count", ackField: "ack_mano_obra_empty" },
  { pageName: "page_uniforme",  countField: "uniforme_count",  ackField: "ack_uniforme_empty"  },
  // ➕ Agrega aquí tus demás rubros: { pageName: "page_epp", countField: "epp_count", ackField: "ack_epp_empty" }, ...
];

function readInt(root, field) {
  const el = root.querySelector(`.o_field_widget[name="${field}"] input, [name="${field}"] input`);
  return el ? parseInt(el.value || "0") : 0;
}
function readBool(root, field) {
  const el = root.querySelector(`.o_field_widget[name="${field}"] input[type="checkbox"], [name="${field}"] input[type="checkbox"]`);
  return el ? !!el.checked : false;
}
function linkForPage(root, pageName) {
  const panel = root.querySelector(`.o_notebook .o_notebook_page[name="${pageName}"]`);
  if (!panel) return null;
  const id = panel.getAttribute("id");
  if (!id) return null;
  // Bootstrap 5 usa data-bs-target; fallback a href
  return root.querySelector(`.o_notebook .nav-link[data-bs-target="#${id}"], .o_notebook .nav-link[href="#${id}"]`);
}

function applyTabStatuses(root) {
  const form = root.closest(".o_form_view");
  if (!form) return;
  PAGES.forEach((p) => {
    const link = linkForPage(form, p.pageName);
    if (!link) return;
    const count = readInt(form, p.countField);
    const ack   = readBool(form, p.ackField);
    link.classList.remove("ccn-status-empty","ccn-status-ack","ccn-status-filled");
    if (count > 0)       link.classList.add("ccn-status-filled");
    else if (ack)        link.classList.add("ccn-status-ack");
    else                 link.classList.add("ccn-status-empty");
  });
}

const service = {
  name: "ccn_quote_tab_colors",
  start(env) {
    // Ejecuta tras render y en cada parche del DOM
    onMounted(() => applyTabStatuses(document.body));
    onPatched(() => applyTabStatuses(document.body));
    // Reaplica al cambiar cualquier campo en el form
    document.body.addEventListener("change", (ev) => {
      if (ev.target.closest(".o_form_view")) applyTabStatuses(document.body);
    });
  },
};

registry.category("services").add("ccn_quote_tab_colors", service);
