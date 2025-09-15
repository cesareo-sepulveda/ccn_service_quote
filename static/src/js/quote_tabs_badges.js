/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

/* -------------------- Configuración -------------------- */

/** Mapa code ↔ one2many dentro del pane (según tu service_quote.py) */
const O2M_BY_CODE = {
  mano_obra: "line_mano_obra_ids",
  uniforme: "line_uniforme_ids",
  epp: "line_epp_ids",
  epp_alturas: "line_epp_alturas_ids",
  equipo_especial_limpieza: "line_equipo_especial_limpieza_ids",
  comunicacion_computo: "line_comunicacion_computo_ids",
  herramienta_menor_jardineria: "line_herramienta_menor_jardineria_ids",
  material_limpieza: "line_material_limpieza_ids",
  perfil_medico: "line_perfil_medico_ids",
  maquinaria_limpieza: "line_maquinaria_limpieza_ids",
  maquinaria_jardineria: "line_maquinaria_jardineria_ids",
  fertilizantes_tierra_lama: "line_fertilizantes_tierra_lama_ids",
  consumibles_jardineria: "line_consumibles_jardineria_ids",
  capacitacion: "line_capacitacion_ids",
};

/** Solo estos dos tienen “No aplica” (ACK) */
const ACK_BY_CODE = {
  mano_obra: "ack_mano_obra_empty",
  uniforme: "ack_uniforme_empty",
};

/** Alias de código en los tabs */
const CODE_ALIAS = { herr_menor_jardineria: "herramienta_menor_jardineria" };
const toCode = (c) => CODE_ALIAS[c] || c;

/* -------------------- Utilidades -------------------- */

const clsFor = (st) => (st === "ok" ? "ccn-status-filled" : st === "yellow" ? "ccn-status-ack" : "ccn-status-empty");

function tabCode(a) {
  const nameAttr = a.getAttribute("name") || a.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  const t = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/, "");
  m = t.match(/^page_(.+)$/);
  return m ? m[1] : null;
}

function paneFor(link) {
  const id = (link.getAttribute("aria-controls") || link.getAttribute("data-bs-target") || link.getAttribute("href") || "").replace(/^#/, "");
  return id ? document.getElementById(id) : null;
}

function clearTab(link) {
  const li = link.closest("li");
  const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
  link.classList.remove(...rm);
  if (li) li.classList.remove(...rm);
}

function applyTabState(link, state) {
  const li = link.closest("li");
  const cls = clsFor(state);
  if (!link.classList.contains("active")) { // no tocamos look del activo
    link.classList.add(cls);
  }
  if (li && !li.classList.contains("active")) {
    li.classList.add(cls);
  }
}

function countRowsInPane(pane, o2mName) {
  if (!pane || !o2mName) return 0;
  const box = pane.querySelector(`[name="${o2mName}"], [data-name="${o2mName}"]`);
  if (!box) return 0;

  // List view embebido
  const tbody = box.querySelector(".o_list_view tbody");
  if (tbody) {
    // Filas de datos (excluye placeholders)
    return tbody.querySelectorAll("tr.o_data_row, tr[data-id]").length;
  }

  // Kanban (fallback simple)
  const kan = box.querySelector(".o_kanban_view");
  if (kan) return kan.querySelectorAll(".o_kanban_record, .oe_kanban_card").length;

  return 0;
}

function readAckFromDom(fieldName) {
  // Checkbox estándar
  const cb =
    document.querySelector(`input[name="${fieldName}"]`) ||
    document.querySelector(`[name="${fieldName}"] .o_checkbox input`);
  if (cb && "checked" in cb) return !!cb.checked;

  // Otros widgets → data-value/value/texto
  const el = document.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
  if (!el) return false;
  const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent ?? "";
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "sí" || s === "si";
}

/** Regla: filas>0 → ok; filas=0 y ACK → yellow; si no → red */
function computeStateFor(link, code) {
  const pane = paneFor(link);
  const o2m = O2M_BY_CODE[code];
  const rows = countRowsInPane(pane, o2m);
  if (rows > 0) return "ok";
  const ackField = ACK_BY_CODE[code];
  if (ackField && readAckFromDom(ackField)) return "yellow";
  return "red";
}

/* -------------------- Prefill opcional desde servidor (solo al inicio) -------------------- */

async function tryServerPrefill() {
  // Si existe el método get_rubro_states lo usamos para colorear TODO al inicio.
  const el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
  const id = el ? parseInt(el.getAttribute("data-res-id"), 10) : NaN;
  if (!Number.isFinite(id)) return null;
  try {
    const res = await rpc("/web/dataset/call_kw/ccn.service.quote/get_rubro_states", {
      model: "ccn.service.quote",
      method: "get_rubro_states",
      args: [[id]],
      kwargs: {},
    });
    if (!res || typeof res !== "object") return null;
    // Mapea 0/1/2 → red/ok/yellow
    const map = {};
    for (const [k, v] of Object.entries(res)) {
      map[k] = v === 1 ? "ok" : v === 2 ? "yellow" : "red";
    }
    return map;
  } catch {
    return null; // si no existe el método, seguimos sin prefill
  }
}

/* -------------------- Servicio principal -------------------- */

const service = {
  name: "ccn_quote_tabs_service",
  async start() {
    const notebook = document.querySelector(".o_form_view .o_notebook");
    if (!notebook) return;

    // Indexar tabs por code
    const links = [...notebook.querySelectorAll(".nav-tabs .nav-link")];
    const byCode = {};
    for (const a of links) {
      const raw = tabCode(a);
      if (!raw) continue;
      byCode[toCode(raw)] = a;
    }

    // 1) Pintado inicial (una sola vez):
    //    - Si hay prefill de servidor: se aplica a todos.
    //    - Además, para panes ya montados, calculamos por contenido (por si difiere).
    const pre = await tryServerPrefill();
    for (const [code, a] of Object.entries(byCode)) {
      clearTab(a);
      const st = pre?.[code] ?? computeStateFor(a, code);
      applyTabState(a, st);
    }

    // 2) SOLO repintamos cuando cambie el CONTENIDO de un pane o un ACK.
    //    Observamos el contenedor de panes y reaccionamos a mutaciones.
    const dirty = new Set();
    let scheduled = false;

    function scheduleRepaint() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        for (const code of dirty) {
          const a = byCode[code];
          if (!a) continue;
          const st = computeStateFor(a, code);
          clearTab(a);
          applyTabState(a, st);
        }
        dirty.clear();
      }, 60);
    }

    function markDirtyByPane(pane) {
      if (!pane?.id) return;
      const m = pane.id.match(/^page_(.+)$/);
      if (!m) return;
      const code = toCode(m[1]);
      if (byCode[code]) {
        dirty.add(code);
        scheduleRepaint();
      }
    }

    // Observa todo el contenido de tabs (altas/bajas de filas, montajes de panes, etc.)
    const tabContent = notebook.querySelector(".tab-content") || notebook;
    const mo = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        // Si se añade un pane completo, o cambia su interior, marcamos su code
        const added = [...mut.addedNodes].filter((n) => n.nodeType === 1);
        for (const n of added) {
          if (n.classList?.contains("tab-pane")) markDirtyByPane(n);
          const pane = n.closest?.(".tab-pane");
          if (pane) markDirtyByPane(pane);
        }
        if (mut.target?.classList?.contains("tab-pane")) markDirtyByPane(mut.target);
        const pane = mut.target?.closest?.(".tab-pane");
        if (pane) markDirtyByPane(pane);
      }
    });
    mo.observe(tabContent, { childList: true, subtree: true });

    // 3) Cambios de ACK → repintar SOLO el tab relacionado
    document.body.addEventListener("change", (ev) => {
      const nm = ev.target?.getAttribute?.("name");
      if (!nm) return;
      for (const [code, field] of Object.entries(ACK_BY_CODE)) {
        if (nm === field) {
          if (byCode[code]) {
            dirty.add(code);
            scheduleRepaint();
          }
        }
      }
    });
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
