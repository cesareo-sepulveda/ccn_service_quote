/** @odoo-module **/

import { registry } from "@web/core/registry";

/* Helpers */
function normCode(code) {
  return code === "herr_menor_jardineria" ? "herramienta_menor_jardineria" : code;
}
function normState(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "ok" || s === "green" || s === "verde") return "ok";
  if (s.startsWith("yell") || s === "amarillo") return "yellow";
  if (s === "red" || s === "rojo") return "red";
  return "";
}
function linkCode(a) {
  const nameAttr = a.getAttribute("name") || a.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  const tgt = (
    a.getAttribute("aria-controls") ||
    a.getAttribute("data-bs-target") ||
    a.getAttribute("data-target") ||
    a.getAttribute("href") || ""
  ).replace(/^#/, "");
  m = tgt.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

/* Leemos SIEMPRE de los <field name="rubro_state_*"> ocultos (ya están en el DOM por tu XML) */
function readStatesFromHidden(form) {
  const box =
    form.querySelector(".o_ccn_rubro_states") ||
    form.querySelector('.d-none .o_ccn_rubro_states') ||
    form.querySelector('[name="rubro_state_mano_obra"]')?.closest?.("div");
  if (!box) return null;

  const map = {};
  box.querySelectorAll('[name^="rubro_state_"], [data-name^="rubro_state_"]').forEach((el) => {
    const name = el.getAttribute("name") || el.getAttribute("data-name") || "";
    const code = name.replace(/^rubro_state_/, "");
    const raw = el.getAttribute("data-value") || el.dataset?.value || el.value || el.getAttribute("value") || el.textContent;
    const v = normState(raw);
    if (code && v) map[code] = v;
  });
  return Object.keys(map).length ? map : null;
}

function clsFor(state) {
  return state === "ok" ? "ccn-status-filled" : state === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
}

function clearTab(a, li) {
  const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
  a.classList.remove(...rm);
  if (li) li.classList.remove(...rm);
}

/* Aplica clases de estado al <a> y también al <li> (clave para colorear inactivos) */
function applyInForm(form) {
  const notebook = form.querySelector(".o_notebook");
  if (!notebook) return;

  const links = notebook.querySelectorAll(".nav-tabs .nav-link");
  if (!links.length) return;

  const map = readStatesFromHidden(form);
  if (!map) return;

  links.forEach((a) => {
    const li = a.closest("li");
    clearTab(a, li);

    const raw = linkCode(a);
    if (!raw) return;

    const code = normCode(raw);
    let st = map[code];
    if (!st && code === "herr_menor_jardineria") st = map["herramienta_menor_jardineria"];
    st = normState(st) || "red";

    const cls = clsFor(st);
    a.classList.add(cls);
    if (li) li.classList.add(cls);
  });
}

function applyAll() {
  document.querySelectorAll(".o_form_view").forEach(applyInForm);
}

/* Servicio */
let t0, t1;
function schedule() {
  clearTimeout(t0); clearTimeout(t1);
  t0 = setTimeout(applyAll, 0);
  t1 = setTimeout(applyAll, 120);
}

const service = {
  name: "ccn_quote_tabs_service",
  start() {
    const root = document.body;
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });

    root.addEventListener("shown.bs.tab", schedule, true);
    root.addEventListener("hidden.bs.tab", schedule, true);
    root.addEventListener("click", (e) => {
      if (e.target.closest(".o_notebook .nav-tabs .nav-link")) schedule();
    });

    schedule();
    window.__ccnTabsDebug = { applyAll: schedule };
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
