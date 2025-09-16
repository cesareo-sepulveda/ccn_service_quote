/** CCN Quote Tabs Badges — DOM only + montaje silencioso (Odoo 18 CE, sin imports)
 *  - Inicial: recorre cada tab, lo activa un instante para que monte el pane, cuenta filas y pinta.
 *    Luego regresa al tab original. No usa res_id ni llamadas RPC.
 *  - Después: repinta SOLO cuando cambia contenido (altas/bajas) o cambian ACKs.
 *  - No repinta al cambiar de pestaña.
 *  - No toca tu SCSS (chevrons). Solo aplica: ccn-status-filled / ccn-status-ack / ccn-status-empty.
 */

(function () {
  "use strict";

  /* ==== Mapeo etiqueta → código de rubro (ajusta si tus textos difieren) ==== */
  function normalizeLabel(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");
  }
  const LABEL_TO_CODE = {
    "mano de obra": "mano_obra",
    "uniforme": "uniforme",
    "epp": "epp",
    "epp alturas": "epp_alturas",
    "equipo especial de limpieza": "equipo_especial_limpieza",
    "comunicacion y computo": "comunicacion_computo",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "herramienta menor jardineria": "herramienta_menor_jardineria",
    "material de limpieza": "material_limpieza",
    "perfil medico": "perfil_medico",
    "maquinaria limpieza": "maquinaria_limpieza",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "maquinaria jardineria": "maquinaria_jardineria",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "consumibles jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };

  /* ==== One2many por código (para contar filas dentro del pane) ==== */
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

  // ACK solo para estos dos
  const ACK_BY_CODE = { mano_obra: "ack_mano_obra_empty", uniforme: "ack_uniforme_empty" };

  /* ==== Helpers de estilo ==== */
  function clsFor(state) {
    // state: "ok" | "yellow" | "red"
    return state === "ok" ? "ccn-status-filled" : state === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
  }
  function clearTab(link) {
    if (!link) return;
    const li = link.closest ? link.closest("li") : null;
    const rm = ["ccn-status-filled", "ccn-status-ack", "ccn-status-empty"];
    link.classList.remove(...rm);
    if (li) li.classList.remove(...rm);
  }
  function applyTabState(link, state) {
    if (!link) return;
    const li = link.closest ? link.closest("li") : null;
    const c = clsFor(state);
    link.classList.add(c);
    if (li) li.classList.add(c);
  }

  /* ==== DOM utils ==== */
  function tabLabel(link) {
    return normalizeLabel(link ? link.textContent : "");
  }
  function paneFor(link) {
    if (!link) return null;
    const id = (link.getAttribute("aria-controls") || link.getAttribute("data-bs-target") || link.getAttribute("href") || "").replace(/^#/, "");
    return id ? document.getElementById(id) : null;
  }

  /* ==== Contadores de contenido ==== */
  function countRowsInPane(pane, o2mName) {
    if (!pane || !o2mName) return 0;
    // Contenedor del widget x2many
    const box =
      pane.querySelector(`[name="${o2mName}"], [data-name="${o2mName}"], .o_field_widget[name="${o2mName}"]`) ||
      pane.querySelector(`.o_field_x2many[name="${o2mName}"]`);
    if (!box) return 0;

    // List view embebido
    const tbody = box.querySelector(".o_list_view tbody, .o_list_renderer tbody");
    if (tbody) {
      // Odoo 18: filas reales tienen data-id o clase .o_data_row
      return tbody.querySelectorAll("tr[data-id], tr.o_data_row").length;
    }

    // Kanban embebido
    const kanban = box.querySelector(".o_kanban_view, .o_kanban_renderer");
    if (kanban) {
      return kanban.querySelectorAll(".o_kanban_record, .oe_kanban_card").length;
    }

    // Editable list (inline) puede no tener tbody aún
    const rows = box.querySelectorAll('tr[role="row"][data-id], .o_data_row');
    if (rows && rows.length) return rows.length;

    return 0;
  }

  function readAckFromDom(fieldName) {
    const cb =
      document.querySelector(`input[name="${fieldName}"]`) ||
      document.querySelector(`[name="${fieldName}"] .o_checkbox input`);
    if (cb && "checked" in cb) return !!cb.checked;

    const el = document.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if (!el) return false;
    const raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
    const s = String(raw).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "sí" || s === "si";
  }

  function computeStateFromDom(link, code) {
    try {
      const pane = paneFor(link);
      const o2m = O2M_BY_CODE[code];
      const rows = countRowsInPane(pane, o2m);
      if (rows > 0) return "ok";
      // Sin filas → mirar ACK si aplica
      const ackField = ACK_BY_CODE[code];
      if (ackField && readAckFromDom(ackField)) return "yellow";
      return "red";
    } catch (e) {
      return "red";
    }
  }

  /* ==== Montaje silencioso (activar un tab, esperar a que monte, medir y volver) ==== */

  function getActiveLink(nav) {
    return nav.querySelector(".nav-link.active") || null;
  }

  function showTabAndWait(link, timeoutMs = 450) {
    return new Promise((resolve) => {
      if (!link) return resolve();
      const pane = paneFor(link);
      // Si ya hay contenido, no hace falta esperar
      if (pane && (pane.querySelector(".o_list_view, .o_list_renderer, .o_kanban_view, .o_kanban_renderer"))) {
        // Aún así activamos para no desincronizarnos
        link.click?.();
        return setTimeout(resolve, 0);
      }
      // Activar tab
      link.click?.();

      // Esperar a que aparezca contenido o hasta timeout
      const started = Date.now();
      const obs = new MutationObserver(() => {
        if (!pane) return;
        if (pane.querySelector(".o_list_view, .o_list_renderer, .o_kanban_view, .o_kanban_renderer")) {
          obs.disconnect();
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          obs.disconnect();
          resolve(); // seguimos aunque no veamos renderer (contaremos 0 si no montó)
        }
      });
      if (pane) {
        obs.observe(pane, { childList: true, subtree: true });
      }
      // Salvaguarda por si no hubo mutaciones
      setTimeout(() => {
        try { obs.disconnect(); } catch {}
        resolve();
      }, timeoutMs + 50);
    });
  }

  async function initialSweep(notebook, byCode) {
    const nav = notebook.querySelector(".nav-tabs");
    if (!nav) return;

    const links = Object.values(byCode);
    if (!links.length) return;

    const activeBefore = getActiveLink(nav);

    // Recorremos tabs: activar, esperar montaje, medir y pintar
    for (const link of links) {
      try {
        await showTabAndWait(link);
        const lbl = normalizeLabel(link.textContent);
        const code = Object.keys(byCode).find((c) => byCode[c] === link);
        if (!code) continue;
        const state = computeStateFromDom(link, code);
        clearTab(link);
        applyTabState(link, state);
      } catch (e) {
        // pinta rojo si algo salió mal
        clearTab(link);
        applyTabState(link, "red");
      }
    }

    // Volver al tab que estaba activo
    if (activeBefore && activeBefore !== getActiveLink(nav)) {
      try { activeBefore.click?.(); } catch {}
    }
  }

  /* ==== Observadores de cambios (solo contenido / ACK) ==== */
  function setupObservers(notebook, byCode) {
    const tabContent = notebook.querySelector(".tab-content") || notebook;
    let dirty = {};
    let scheduled = false;

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        try {
          Object.keys(dirty).forEach((code) => {
            const link = byCode[code];
            if (!link) return;
            const st = computeStateFromDom(link, code);
            clearTab(link);
            applyTabState(link, st);
          });
        } catch {}
        dirty = {};
      }, 60);
    }

    // Marca sucio el código cuyo pane recibió cambios en DOM
    function markDirtyByPane(pane) {
      if (!pane) return;
      // Detectar el code por presencia del O2M en ese pane
      for (const [code, o2m] of Object.entries(O2M_BY_CODE)) {
        if (pane.querySelector(`[name="${o2m}"], [data-name="${o2m}"], .o_field_widget[name="${o2m}"]`)) {
          if (byCode[code]) dirty[code] = true;
        }
      }
    }

    const mo = new MutationObserver((muts) => {
      try {
        for (const mut of muts) {
          const pane = mut.target?.closest?.(".tab-pane");
          if (pane) markDirtyByPane(pane);
          for (const n of mut.addedNodes || []) {
            if (!(n instanceof Element)) continue;
            const p2 = n.classList?.contains("tab-pane") ? n : n.closest?.(".tab-pane");
            if (p2) markDirtyByPane(p2);
          }
        }
      } catch {}
      if (Object.keys(dirty).length) schedule();
    });
    mo.observe(tabContent, { childList: true, subtree: true });

    // Cambios de ACK → solo su tab
    document.addEventListener("change", (ev) => {
      try {
        const nm = ev.target?.getAttribute?.("name");
        if (!nm) return;
        for (const [code, field] of Object.entries(ACK_BY_CODE)) {
          if (nm === field && byCode[code]) {
            dirty[code] = true;
          }
        }
        if (Object.keys(dirty).length) schedule();
      } catch {}
    });
  }

  /* ==== Arranque ==== */
  function waitNotebook(cb) {
    const nb = document.querySelector(".o_form_view .o_notebook");
    if (nb) return cb(nb);
    const mo = new MutationObserver(() => {
      const n = document.querySelector(".o_form_view .o_notebook");
      if (n) {
        mo.disconnect();
        cb(n);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  try {
    waitNotebook(async function (notebook) {
      // Indexar tabs por etiqueta → código
      const links = [...notebook.querySelectorAll(".nav-tabs .nav-link")];
      if (!links.length) return;

      const byCode = {};
      for (const a of links) {
        const code = LABEL_TO_CODE[normalizeLabel(a.textContent)];
        if (code) byCode[code] = a;
      }

      // Barrido inicial (montaje silencioso + pintado)
      await initialSweep(notebook, byCode);

      // Observadores para cambios reales de contenido / ACK
      setupObservers(notebook, byCode);

      // Depuración opcional
      window.__ccnTabsLive = {
        repaint(code) {
          try {
            if (code && byCode[code]) {
              const a = byCode[code];
              const st = computeStateFromDom(a, code);
              clearTab(a); applyTabState(a, st);
              return;
            }
            Object.keys(byCode).forEach((c) => {
              const a = byCode[c];
              const st = computeStateFromDom(a, c);
              clearTab(a); applyTabState(a, st);
            });
          } catch {}
        },
      };
    });
  } catch {}
})();
