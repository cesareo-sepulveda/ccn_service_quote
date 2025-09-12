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
const ALIAS = { "herr_menor_jardineria": "herramienta_menor_jardineria" };
const toCode = (c) => ALIAS[c] || c;

function tabCode(a) {
  const nameAttr = a.getAttribute("name") || a.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  const t = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/, "");
  m = t.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

/** 0/1/2 (o string) -> "red" | "ok" | "yellow" */
function toState(v) {
  if (v === 2 || v === "2") return "yellow";
  if (v === 1 || v === "1") return "ok";
  return "red";
}
const clsFor = (s) => (s === "ok" ? "ccn-status-filled" : s === "yellow" ? "ccn-status-ack" : "ccn-status-empty");

/* ---------- ID del registro ---------- */
function getRecordId() {
  // 1) Atributo del DOM (forma más estable)
  try {
    const el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    const rid = el ? parseInt(el.getAttribute("data-res-id"), 10) : NaN;
    if (Number.isFinite(rid)) return rid;
  } catch {}
  // 2) Cualquier otro data-res-id en la vista
  try {
    const any = document.querySelector('.o_form_view [data-res-id]');
    const rid = any ? parseInt(any.getAttribute("data-res-id"), 10) : NaN;
    if (Number.isFinite(rid)) return rid;
  } catch {}
  // 3) URL/hash
  try {
    const h = location.hash || "";
    const m = h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    if (m) return parseInt(m[1], 10);
  } catch {}
  return null;
}

/* ---------- RPC correcto: args [[id], FIELDS] ---------- */
async function fetchStates(resId) {
  const res = await rpc("/web/dataset/call_kw/ccn.service.quote/read", {
    model: "ccn.service.quote",
    method: "read",
    args: [[resId], FIELDS],   // <- ESTA es la forma correcta
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

/* ---------- Pintado ---------- */
function clearTab(a, li) {
  const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
  a.classList.remove(...rm);
  if (li) li.classList.remove(...rm);
}

function paintWithMap(form, map) {
  const links = form.querySelectorAll(".o_notebook .nav-tabs .nav-link");
  links.forEach((a) => {
    const li = a.closest("li");
    clearTab(a, li);

    const raw = tabCode(a);
    if (!raw) return;
    const code = toCode(raw);

    let st = map[code];
    if (!st && ALIAS[raw]) st = map[ALIAS[raw]];
    if (!st) st = "red";

    const cls = clsFor(st);
    a.classList.add(cls);
    if (li) li.classList.add(cls);
  });
}

async function applyAll() {
  const form = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"]') || document.querySelector(".o_form_view");
  if (!form) return;

  const id = getRecordId();
  if (!id) return;

  try {
    const map = await fetchStates(id);
    if (map) paintWithMap(form, map);
  } catch (e) {
    // opcional: console.warn("[ccn tabs] error al cargar estados", e);
  }
}

/* ---------- Servicio ---------- */
let t0, t1, t2;
function schedule() {
  [t0, t1, t2].forEach((t) => t && clearTimeout(t));
  t0 = setTimeout(applyAll, 0);
  t1 = setTimeout(applyAll, 120);
  t2 = setTimeout(applyAll, 400);
}

const service = {
  name: "ccn_quote_tabs_service", // mismo nombre => reemplaza el previo
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
