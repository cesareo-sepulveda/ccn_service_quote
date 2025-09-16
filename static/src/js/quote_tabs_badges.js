/** CCN Quote Tabs Badges — robusto por ETIQUETA del tab (Odoo 18 CE, sin imports)
 *  - Inicial: read_group por rubro_code (fallback rubro_id) + ACK.
 *  - Mapea cada tab por su TEXTO visible (no por page_XXX).
 *  - Repinta solo cuando cambia contenido o ACK. No repinta al cambiar de tab.
 */

(function () {
  "use strict";

  /* ==== Nombres de One2many en el encabezado (para repintar por contenido) ==== */
  var O2M_BY_CODE = {
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
  var ALL_CODES = Object.keys(O2M_BY_CODE);

  /* ==== Mapeo por ETIQUETA visible → código de rubro ==== */
  function normalizeLabel(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // sin acentos
      .replace(/\s+/g, " "); // espacios compactos
  }
  var LABEL_TO_CODE = {
    "mano de obra": "mano_obra",
    uniforme: "uniforme",
    epp: "epp",
    "epp alturas": "epp_alturas",
    "equipo especial de limpieza": "equipo_especial_limpieza",
    "comunicacion y computo": "comunicacion_computo",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "herramienta menor jardineria": "herramienta_menor_jardineria",
    "material de limpieza": "material_limpieza",
    "perfil medico": "perfil_medico",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "maquinaria jardineria": "maquinaria_jardineria",
    "maquinaria limpieza": "maquinaria_limpieza",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "consumibles jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };

  var ACK_BY_CODE = { mano_obra: "ack_mano_obra_empty", uniforme: "ack_uniforme_empty" };

  function clsFor(st) {
    return st === "ok" ? "ccn-status-filled" : st === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
  }

  /* ==== Utilidades DOM ==== */
  function tabLabel(a) {
    // texto visible del <a> (sin espacios duplicados)
    return normalizeLabel(a ? a.textContent : "");
  }
  function paneFor(link) {
    if (!link) return null;
    var id = (link.getAttribute("aria-controls") || link.getAttribute("data-bs-target") || link.getAttribute("href") || "").replace(/^#/, "");
    return id ? document.getElementById(id) : null;
  }
  function clearTab(link) {
    if (!link) return;
    var li = link.closest ? link.closest("li") : null;
    var rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove.apply(link.classList, rm);
    if (li) li.classList.remove.apply(li.classList, rm);
  }
  function applyTabState(link, state) {
    if (!link) return;
    var li = link.closest ? link.closest("li") : null;
    var cls = clsFor(state);
    link.classList.add(cls);
    if (li) li.classList.add(cls);
  }
  function getResId() {
    var el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    if (el) {
      var rid = parseInt(el.getAttribute("data-res-id"), 10);
      if (!isNaN(rid)) return rid;
    }
    var h = location.hash || "";
    var m = h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ==== Conteo por contenido (repintados) ==== */
  function countRowsInPane(pane, o2mName) {
    if (!pane || !o2mName) return 0;
    var box = pane.querySelector('[name="'+o2mName+'"], [data-name="'+o2mName+'"]');
    if (!box) return 0;
    var tbody = box.querySelector(".o_list_view tbody");
    if (tbody) return tbody.querySelectorAll("tr.o_data_row, tr[data-id]").length;
    var kan = box.querySelector(".o_kanban_view");
    if (kan) return kan.querySelectorAll(".o_kanban_record, .oe_kanban_card").length;
    return 0;
  }
  function readAckFromDom(fieldName) {
    var cb = document.querySelector('input[name="'+fieldName+'"]') ||
             document.querySelector('[name="'+fieldName+'"] .o_checkbox input');
    if (cb && "checked" in cb) return !!cb.checked;
    var el = document.querySelector('[name="'+fieldName+'"], [data-name="'+fieldName+'"]');
    if (!el) return false;
    var raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
    var s = String(raw).trim().toLowerCase();
    return (s === "1" || s === "true" || s === "yes" || s === "sí" || s === "si");
  }
  function computeStateFor(link, code) {
    try {
      var pane = paneFor(link);
      var o2m = O2M_BY_CODE[code];
      var rows = countRowsInPane(pane, o2m);
      if (rows > 0) return "ok";
      var ackField = ACK_BY_CODE[code];
      if (ackField && readAckFromDom(ackField)) return "yellow";
      return "red";
    } catch (e) { return "red"; }
  }

  /* ==== JSON-RPC helper (formato correcto) ==== */
  function callKw(model, method, args, kwargs) {
    var payload = {
      jsonrpc: "2.0",
      method: "call",
      params: { model: model, method: method, args: args || [], kwargs: kwargs || {} },
      id: Date.now()
    };
    return fetch("/web/dataset/call_kw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.error) throw j.error; return j ? j.result : null; });
  }

  /* ==== Pintado inicial desde servidor (por rubro_code; fallback rubro_id) ==== */
  function fetchInitialMap(resId) {
    if (!resId) return Promise.resolve(null);

    function buildMapFromCounts(countsByCode, ack) {
      var map = {};
      ALL_CODES.forEach(function (code) {
        var n = countsByCode[code] || 0;
        if (n > 0) map[code] = "ok";
        else if (code === "mano_obra" && ack.ack_mano_obra_empty) map[code] = "yellow";
        else if (code === "uniforme" && ack.ack_uniforme_empty) map[code] = "yellow";
        else map[code] = "red";
      });
      return map;
    }

    // 1) ACKs
    return callKw("ccn.service.quote", "read", [[resId], ["ack_mano_obra_empty", "ack_uniforme_empty"]], {})
      .then(function (r) {
        var rec = Array.isArray(r) ? r[0] : null;
        var ack = {
          ack_mano_obra_empty: !!(rec && rec.ack_mano_obra_empty),
          ack_uniforme_empty: !!(rec && rec.ack_uniforme_empty),
        };

        // 2) A: read_group por rubro_code
        return callKw(
          "ccn.service.quote.line",
          "read_group",
          [[["quote_id", "=", resId]], ["id:count"], ["rubro_code"]],
          { lazy: false }
        ).then(function (groups) {
          var countsByCode = {};
          (groups || []).forEach(function (g) {
            var code = g.rubro_code;
            if (!code) return;
            var cnt = g.id_count != null ? g.id_count : (g.__count || 0);
            countsByCode[code] = (countsByCode[code] || 0) + (cnt || 0);
          });

          if (Object.keys(countsByCode).length) {
            return buildMapFromCounts(countsByCode, ack);
          }

          // 3) B: si A no trajo nada, read_group por rubro_id y mapeo a code
          return callKw(
            "ccn.service.quote.line",
            "read_group",
            [[["quote_id", "=", resId]], ["id:count"], ["rubro_id"]],
            { lazy: false }
          ).then(function (groups2) {
            groups2 = Array.isArray(groups2) ? groups2 : [];
            var ridToCount = {};
            var rids = [];
            groups2.forEach(function (g) {
              var rid = (g.rubro_id && g.rubro_id[0]) || null;
              if (!rid) return;
              var cnt = g.id_count != null ? g.id_count : (g.__count || 0);
              ridToCount[rid] = (ridToCount[rid] || 0) + (cnt || 0);
              rids.push(rid);
            });
            rids = Array.from(new Set(rids));
            if (!rids.length) {
              return buildMapFromCounts({}, ack);
            }
            return callKw("ccn.service.rubro", "read", [rids, ["code"]], {}).then(function (rubros) {
              var idToCode = {};
              (rubros || []).forEach(function (rb) { idToCode[rb.id] = rb.code; });
              var countsByCode2 = {};
              Object.keys(ridToCount).forEach(function (ridStr) {
                var rid = parseInt(ridStr, 10);
                var code = idToCode[rid];
                if (!code) return;
                countsByCode2[code] = (countsByCode2[code] || 0) + (ridToCount[rid] || 0);
              });
              return buildMapFromCounts(countsByCode2, ack);
            });
          });
        });
      })
      .catch(function () { return null; });
  }

  /* ==== Arranque ==== */
  function waitNotebook(cb) {
    var nb = document.querySelector(".o_form_view .o_notebook");
    if (nb) return cb(nb);
    var mo = new MutationObserver(function () {
      var n = document.querySelector(".o_form_view .o_notebook");
      if (n) { mo.disconnect(); cb(n); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  try {
    waitNotebook(function (notebook) {
      var links = [].slice.call(notebook.querySelectorAll(".nav-tabs .nav-link"));
      if (!links.length) return;

      // Indexar TABS por ETIQUETA → código
      var byCode = {};
      links.forEach(function (a) {
        var lbl = tabLabel(a);            // ej. "mano de obra"
        var code = LABEL_TO_CODE[lbl];    // ej. "mano_obra"
        if (code) byCode[code] = a;
      });

      // === Pintado INICIAL ===
      var resId = getResId();
      fetchInitialMap(resId).then(function (initialMap) {
        try {
          Object.keys(byCode).forEach(function (code) {
            var a = byCode[code];
            clearTab(a);
            var st = (initialMap && initialMap[code]) || computeStateFor(a, code);
            applyTabState(a, st);
          });
        } catch (e) {}
      });

      // === Repintar SOLO en cambios de contenido / ACK ===
      var dirty = {};
      var scheduled = false;
      function schedule() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () {
          scheduled = false;
          try {
            Object.keys(dirty).forEach(function (code) {
              var a = byCode[code];
              if (!a) return;
              var st = computeStateFor(a, code);
              clearTab(a);
              applyTabState(a, st);
            });
          } catch (e) {}
          dirty = {};
        }, 60);
      }

      function codeFromPane(pane) {
        if (!pane) return null;
        // Detectar el O2M presente para mapear a code (cuando el pane está montado)
        for (var code in O2M_BY_CODE) {
          var o2m = O2M_BY_CODE[code];
          if (pane.querySelector('[name="'+o2m+'"], [data-name="'+o2m+'"]')) return code;
        }
        return null;
      }

      var tabContent = notebook.querySelector(".tab-content") || notebook;
      var mo = new MutationObserver(function (muts) {
        try {
          for (var i = 0; i < muts.length; i++) {
            var mut = muts[i];
            var pane = (mut.target && mut.target.closest) ? mut.target.closest(".tab-pane") : null;
            if (pane) {
              var c = codeFromPane(pane);
              if (c && byCode[c]) dirty[c] = true;
            }
            var added = [].slice.call(mut.addedNodes || []);
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              if (!(n && n.nodeType === 1)) continue;
              var p2 = n.classList && n.classList.contains("tab-pane") ? n : (n.closest && n.closest(".tab-pane"));
              if (p2) {
                var c2 = codeFromPane(p2);
                if (c2 && byCode[c2]) dirty[c2] = true;
              }
            }
          }
        } catch (e) {}
        if (Object.keys(dirty).length) schedule();
      });
      mo.observe(tabContent, { childList: true, subtree: true });

      document.addEventListener("change", function (ev) {
        try {
          var nm = ev.target && ev.target.getAttribute && ev.target.getAttribute("name");
          if (!nm) return;
          Object.keys(ACK_BY_CODE).forEach(function (code) {
            if (nm === ACK_BY_CODE[code] && byCode[code]) {
              dirty[code] = true;
            }
          });
          if (Object.keys(dirty).length) schedule();
        } catch (e) {}
      });

      // Depuración opcional: window.__ccnTabsLive.repaint()
      window.__ccnTabsLive = {
        repaint: function (code) {
          try {
            if (code && byCode[code]) {
              var a = byCode[code]; var st = computeStateFor(a, code);
              clearTab(a); applyTabState(a, st); return;
            }
            Object.keys(byCode).forEach(function (c) {
              var a = byCode[c]; var st = computeStateFor(a, c);
              clearTab(a); applyTabState(a, st);
            });
          } catch (e) {}
        }
      };
    });
  } catch (e) { /* nunca romper el cliente */ }
})();
