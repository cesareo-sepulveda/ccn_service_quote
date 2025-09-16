/** @odoo-module **/

import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

/* ========= Config ========= */

/** code ↔ one2many (según tu service_quote.py) */
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

/** ACK por code (sólo estos 2 en tu modelo) */
const ACK_BY_CODE = {
  mano_obra: "ack_mano_obra_empty",
  uniforme: "ack_uniforme_empty",
};

/** Alias de código en tabs */
const CODE_ALIAS = { herr_menor_jardineria: "herramienta_menor_jardineria" };
const toCode = (c) => CODE_ALIAS[c] || c;

const clsFor = (st) =>
  st === "ok" ? "ccn-status-filled" : st === "yellow" ? "ccn-status-ack" : "ccn-status-empty";

/* ========= Utilidades DOM ========= */

function tabCode(a) {
  const nameAttr = a.getAttribute("name") || a.dataset.name || "";
  let m = nameAttr.match(/^page_(.+)$/);
  if (m) return m[1];
  const target = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/, "");
  m = target.match(/^page_(.+)$/);
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
  link.classList.add(cls);
  if (li) li.classList.add(cls);
}

function getResId() {
  const el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
  if (el) {
    const rid = parseInt(el.getAttribute("data-res-id"), 10);
    if (Number.isFinite(rid)) return rid;
  }
  const h = location.hash || "";
  const m = h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
  return m ? parseInt(m[1], 10) : null;
}

/* ========= Lectura de contenido (repintado por cambios) ========= */

function countRowsInPane(pane, o2mName) {
  if (!pane || !o2mName) return 0;
  const box = pane.querySelector(`[name="${o2mName}"], [data-name="${o2mName}"]`);
  if (!box) return 0;

  // Lista embebida
  const tbody = box.querySelector(".o_list_view tbody");
  if (tbody) return tbody.querySelectorAll("tr.o_data_row, tr[data-id]").length;

  // Kanban (fallback)
  const kan = box.querySelector(".o_kanban_view");
  if (kan) return kan.querySelectorAll(".o_kanban_record, .oe_kanban_card").length;

  return 0;
}

function readAckFromDom(fieldName) {
  const cb =
    document.querySelector(`input[name="${fieldName}"]`) ||
    document.querySelector(`[name="${fieldName}"] .o_checkbox input`);
  if (cb && "checked" in cb) return !!cb.checked;

  const el = document.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
  if (!el) return false;
  const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent ?? "";
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "sí" || s === "si";
}

/** Regla de estado por contenido: filas>0 → ok; filas=0 & ACK → yellow; si no → red */
function computeStateFor(link, code) {
  const pane = paneFor(link);
  const o2m = O2M_BY_CODE[code];
  const rows = countRowsInPane(pane, o2m);
  if (rows > 0) return "ok";
  const ackField = ACK_BY_CODE[code];
  if (ackField && readAckFromDom(ackField)) return "yellow";
  return "red";
}

/* ========= Pintado inicial (RPC) ========= */
/* Una sola vez: lee ACKs y hace search_count por rubro en servidor.
   Así colorea todos los tabs desde el inicio, aunque los panes aún no estén montados. */

async function fetchInitialMap(resId) {
  // 1) ACKs
  let ack = { ack_mano_obra_empty: false, ack_uniforme_empty: false };
  try {
    const r = await rpc("/web/dataset/call_kw/ccn.service.quote/read", {
      model: "ccn.service.quote",
      method: "read",
      args: [[resId], ["ack_mano_obra_empty", "ack_uniforme_empty"]],
      kwargs: {},
    });
    const rec = Array.isArray(r) ? r[0] : null;
    if (rec) {
      ack.ack_mano_obra_empty = !!rec.ack_mano_obra_empty;
      ack.ack_uniforme_empty = !!rec.ack_uniforme_empty;
    }
  } catch {
    // seguimos sin ACKs
  }

  // 2) search_count por rubro
  const codes = Object.keys(O2M_BY_CODE);
  const counts = await Promise.all(
    codes.map((code) =>
      rpc("/web/dataset/call_kw/ccn.service.quote.line/search_count", {
        model: "ccn.service.quote.line",
        method: "search_count",
        args: [[["quote_id", "=", resId], ["rubro_id.code", "=", code]]],
        kwargs: {},
      }).catch(() => 0)
    )
  );

  // 3) Construir mapa
  const map = {};
  codes.forEach((code, i) => {
    const n = counts[i] || 0;
    if (n > 0) map[code] = "ok";
    else if (code === "mano_obra" && ack.ack_mano_obra_empty) map[code] = "yellow";
    else if (code === "uniforme" && ack.ack_uniforme_empty) map[code] = "yellow";
    else map[code] = "red";
  });
  return map;
}

/* ========= Servicio (Odoo 18) ========= */

const service = {
  name: "ccn_quote_tabs_service",
  async start() {
    // Espera a que exista el notebook para no romper UI
    const waitNotebook = () =>
      new Promise((resolve) => {
        const nb = document.querySelector(".o_form_view .o_notebook");
        if (nb) return resolve(nb);
        const mo = new MutationObserver(() => {
          const n = document.querySelector(".o_form_view .o_notebook");
          if (n) {
            mo.disconnect();
            resolve(n);
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      });

    const notebook = await waitNotebook();
    const links = [...notebook.querySelectorAll(".nav-tabs .nav-link")];
    if (!links.length) return;

    // Indexar tabs por code
    const byCode = {};
    for (const a of links) {
      const raw = tabCode(a);
      if (!raw) continue;
      byCode[toCode(raw)] = a;
    }

    // ===== Pintado inicial (servidor) =====
    const resId = getResId();
    if (resId) {
      try {
        const initialMap = await fetchInitialMap(resId);
        for (const [code, a] of Object.entries(byCode)) {
          clearTab(a);
          applyTabState(a, initialMap[code] || "red");
        }
      } catch {
        // si falla, seguimos con el repintado por contenido
      }
    }

    // ===== Repintar SÓLO cuando cambie el contenido o ACK =====
    const dirty = new Set();
    let scheduled = false;
    const scheduleRepaint = () => {
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
    };

    const codeFromPane = (pane) => {
      if (!pane?.id) return null;
      const m = pane.id.match(/^page_(.+)$/);
      return m ? toCode(m[1]) : null;
    };

    // Observa el contenido de tabs (altas/bajas, remontajes de panes, etc.)
    const tabContent = notebook.querySelector(".tab-content") || notebook;
    const mo = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        const targetPane = mut.target?.closest?.(".tab-pane");
        if (targetPane) {
          const code = codeFromPane(targetPane);
          if (code && byCode[code]) dirty.add(code);
        }
        for (const n of mut.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.classList.contains("tab-pane")) {
            const code = codeFromPane(n);
            if (code && byCode[code]) dirty.add(code);
          } else {
            const pane = n.closest?.(".tab-pane");
            if (pane) {
              const code = codeFromPane(pane);
              if (code && byCode[code]) dirty.add(code);
            }
          }
        }
      }
      if (dirty.size) scheduleRepaint();
    });
    mo.observe(tabContent, { childList: true, subtree: true });

    // Cambios de ACK → recalcular SOLO el tab correspondiente
    document.body.addEventListener("change", (ev) => {
      const nm = ev.target?.getAttribute?.("name");
      if (!nm) return;
      for (const [code, field] of Object.entries(ACK_BY_CODE)) {
        if (nm === field && byCode[code]) {
          dirty.add(code);
          scheduleRepaint();
        }
      }
    });

    // (Opcional) Depuración manual
    window.__ccnTabsLive = {
      repaint(code) {
        if (code && byCode[code]) {
          const a = byCode[code];
          const st = computeStateFor(a, code);
          clearTab(a);
          applyTabState(a, st);
          return;
        }
        for (const [c, a] of Object.entries(byCode)) {
          const st = computeStateFor(a, c);
          clearTab(a);
          applyTabState(a, st);
        }
      },
    };
  },
};

registry.category("services").add("ccn_quote_tabs_service", service);
