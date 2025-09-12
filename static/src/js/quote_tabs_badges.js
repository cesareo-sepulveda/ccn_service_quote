/** @odoo-module **/

import { registry } from "@web/core/registry";

/* -------------------- Helpers -------------------- */

function normCode(code) {
  return code === "herr_menor_jardineria" ? "herramienta_menor_jardineria" : code;
}

/** Acepta números (0/1/2) y textos; devuelve: "ok" | "yellow" | "red" */
function normState(raw) {
  if (raw === null || raw === undefined) return "red";

  // Si ya es número:
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw === 2) return "yellow";
    if (raw === 1) return "ok";
    return "red";
  }

  // Como string:
  const s = String(raw).trim().toLowerCase();

  // Mapeo exacto numérico en string
  if (s === "2") return "yellow";
  if (s === "1") return "ok";
  if (s === "0") return "red";

  // Sinónimos habituales
  if (s === "ok" || s === "green" || s === "verde" || s === "true" || s === "si" || s === "sí") return "ok";
  if (s.startsWith("yell") || s === "amarillo" || s === "ack" || s === "na" || s.includes("no aplica")) return "yellow";
  if (s === "red" || s === "rojo" || s === "empty" || s === "false" || s === "" || s === "none" || s === "null") return "red";

  // Por defecto
  return "red";
}

function classFor(state) {
  return state === "ok" ? "ccn-status-filled" : state === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
}

function linkCode(a) {
  // name="page_CODE"
  const nameAttr = a.getAttribute("name") || a.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];

  // aria-controls / data-bs-target / href="#page_CODE"
  const tgt = (
    a.getAttribute("aria-controls") ||
    a.getAttribute("data-bs-target") ||
    a.getAttribute("data-target") ||
    a.getAttribute("href") ||
    ""
  ).replace(/^#/, "");
  m = tgt.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

/** Lee el mapa de estados desde los <field name="rubro_state_*"> ocultos en el form */
function readStatesFromHidden(form) {
  // Intenta localizar el contenedor de fields ocultos que ya pusiste en tu XML
  const box =
    form.querySelector(".o_ccn_rubro_states") ||
    form.querySelector('.d-none .o_ccn_rubro_states') ||
    form.querySelector('[name="rubro_state_mano_obra"]')?.closest?.("div");
  if (!box) return null;

  const map = {};
  box.querySelectorAll('[name^="rubro_state_"], [data-name^="rubro_state_"]').forEach((el) => {
    const name = el.getAttribute("name") || el.getAttribute("data-name") || "";
    const code = name.replace(/^rubro_state_/, "");
    // Busca valor en data-value, value o texto (según widget)
    const raw =
      el.getAttribute("data-value") ??
      el.dataset?.value ??
      (el.value !== undefined ? el.value : null) ??
      el.getAttribute("value") ??
      el.textContent;

    // Intenta castear a número si parece numérico
    let val = raw;
    if (raw !== null && raw !== undefined) {
      const s = String(raw).trim();
      if (/^-?\d+$/.test(s)) {
        val = parseInt(s, 10);
      }
    }

    const st = normState(val);
    if (code) map[code] = st; // guardamos ya normalizado
  });

  return Object.keys(map).length ? map : null;
}

function clearTab(a, li) {
  const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
  a.classList.remove(...rm);
  if (li) li.classList.remove(...rm);
}

/* -------------------- Núcleo -------------------- */

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
    // st ya viene normalizado por readStatesFromHidden; igual lo reforzamos:
    st = normState(st);

    const cls = classFor(st);
    a.classList.add(cls);
    if (li) li.classList.add(cls);
  });
}

function applyAll() {
  document.querySelectorAll(".o_form_view").forEach(applyInForm);
}

/* -------------------- Servicio -------------------- */

let t0, t1;
function schedule() {
  clearTimeout(t0); clearTimeout(t1);
  t0 = setTimeout(applyAll, 0);
  t1 = setTimeout(applyAll, 120); // ganar a los toggles del tab
}

const service = {
  name: "ccn_quote_tabs_service", // mismo nombre; reemplaza el previo
  start() {
    const root = document.body;
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });

    // Eventos de tabs (Bootstrap) y clicks
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
