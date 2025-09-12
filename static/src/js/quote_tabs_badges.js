/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

/* -------------------- Config -------------------- */
const FIELDS = [
  "rubro_state_mano_obra",
  "rubro_state_uniforme",
  "rubro_state_epp",
  "rubro_state_epp_alturas",
  "rubro_state_equipo_especial_limpieza",
  "rubro_state_comunicacion_computo",
  "rubro_state_herramienta_menor_jardineria",
  "rubro_state_material_limpieza",
  "rubro_state_perfil_medico",
  "rubro_state_maquinaria_limpieza",
  "rubro_state_maquinaria_jardineria",
  "rubro_state_fertilizantes_tierra_lama",
  "rubro_state_consumibles_jardineria",
  "rubro_state_capacitacion",
];

/* -------------------- Helpers -------------------- */
function normCode(code) {
  return code === "herr_menor_jardineria" ? "herramienta_menor_jardineria" : code;
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

/** Mapea 0/1/2 (y strings) -> "red" | "ok" | "yellow" */
function toState(raw) {
  if (raw === 2 || raw === "2") return "yellow";
  if (raw === 1 || raw === "1") return "ok";
  return "red"; // 0, null, undefined, "", etc.
}

function clsFor(state) {
  return state === "ok" ? "ccn-status-filled" : state === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
}

function clearTab(a, li) {
  const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
  a.classList.remove(...rm);
  if (li) li.classList.remove(...rm);
}

/** Intenta obtener el ID actual del registro de varias formas */
function getRecordId() {
  // 1) Odoo debug services (cuando existen)
  try {
    const rid = odoo?.__DEBUG__?.services?.action?.currentController?.model?.root?.data?.id;
    if (Number.isFinite(rid)) return rid;
  } catch {}
  // 2) data-res-id en el DOM
  try {
    const el = document.querySelector(".o_form_view[data-res-id]");
    const rid = el && parseInt(el.getAttribute("data-res-id"), 10);
    if (Number.isFinite(rid)) return rid;
  } catch {}
  // 3) Hash/URL (#id= / #res_id= / #active_id=)
  try {
    const h = location.hash || "";
    const m = h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    if (m) return parseInt(m[1], 10);
  } catch {}
  return null;
}

/* -------------------- Núcleo -------------------- */
async function fetchStates(id) {
  const res = await rpc("/web/dataset/call_kw/ccn.service.quote/read", {
    model: "ccn.service.quote",
    method: "read",
    args: [[id], FIELDS],
    kwargs: {},
  });
  const rec = Array.isArray(res) ? res[0] : null;
  if (!rec) return null;

  const map = {};
  for (const f of FIELDS) {
    const code = f.replace(/^rubro_state_/, "");
    map[code] = toState(rec[f]);
  }
  return map;
}

function paintWithMap(form, map) {
  const notebook = form.querySelector(".o_notebook");
  if (!notebook) return;

  const links = notebook.querySelectorAll(".nav-tabs .nav-link");
  links.forEach((a) => {
    const li = a.closest("li");
    clearTab(a, li);

    const raw = linkCode(a);
    if (!raw) return;
    const code = normCode(raw);

    let st = map[code];
    if (!st && code === "herr_menor_jardineria") st = map["herramienta_menor_jardineria"];
    if (!st) st = "red";

    const cls = clsFor(st);
    a.classList.add(cls);
    if (li) li.classList.add(cls);
  });
}

async function applyAll() {
  const form = document.querySelector(".o_form_view");
  if (!form) return;

  const id = getRecordId();
  if (!id) return;

  try {
    const map = await fetchStates(id);
    if (map) paintWithMap(form, map);
  } catch (e) {
    // silencioso pero visible en consola si estás en dev
    // console.warn("[ccn tabs] no se pudieron obtener estados", e);
  }
}

/* -------------------- Servicio -------------------- */
let t0, t1, t2;
function schedule() {
  [t0, t1, t2].forEach((t) => t && clearTimeout(t));
  t0 = setTimeout(applyAll, 0);
  t1 = setTimeout(applyAll, 120);
  t2 = setTimeout(applyAll, 400); // gana a toggles/animaciones
}

const service = {
  name: "ccn_quote_tabs_service", // mismo nombre → reemplaza el previo
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
