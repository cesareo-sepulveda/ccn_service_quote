/** CCN Quote Tabs Badges — Odoo 18 CE (JSON-RPC, doble estrategia)
 *  - Inicial: read_group por rubro_id; si no hay datos, fallback a rubro_code.
 *  - ACK aplicado cuando conteo==0 (mano_obra/uniforme).
 *  - Repinta sólo ante cambios de contenido o ACK. No repinta al cambiar de tab.
 */

(function () {
  "use strict";

  /* ==== Config ==== */
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

  var ACK_BY_CODE = { mano_obra: "ack_mano_obra_empty", uniforme: "ack_uniforme_empty" };

  // Alias mínimos conocidos
  var CODE_ALIAS = {
    herr_menor_jardineria: "herramienta_menor_jardineria",
    // agrega aquí si alguno difiere (p. ej. 'equipo_especial_de_limpieza': 'equipo_especial_limpieza')
  };
  function toCode(c) { return CODE_ALIAS[c] || c; }

  function clsFor(st) {
    return st === "ok" ? "ccn-status-filled" : st === "yellow" ? "ccn-status-ack" : "ccn-status-empty";
  }

  /* ==== Utilidades DOM ==== */
  function tabCode(a) {
    if (!a) return null;
    var nameAttr = a.getAttribute("name") || (a.dataset ? a.dataset.name : "") || "";
    var m = nameAttr.match(/^page_(.+)$/);
    if (m) return m[1];
    var t = (a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/, "");
    m = t.match(/^page_(.+)$/);
    return m ? m[1] : null;
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

  /* ==== JSON-RPC correcto ==== */
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

  /* ==== Pintado inicial: estrategia A (rubro_id) + fallback B (rubro_code) ==== */
  function fetchInitialMap(resId) {
    if (!resId) return Promise.resolve(null);

    // 1) ACKs
    return callKw("ccn.service.quote", "read", [[resId], ["ack_mano_obra_empty", "ack_uniforme_empty"]], {})
      .then(function (r) {
        var rec = Array.isArray(r) ? r[0] : null;
        var ack = {
          ack_mano_obra_empty: !!(rec && rec.ack_mano_obra_empty),
          ack_uniforme_empty: !!(rec && rec.ack_uniforme_empty),
        };

        // ---- A) read_group por rubro_id ----
        return callKw(
          "ccn.service.quote.line",
          "read_group",
          [[["quote_id", "=", resId]], ["id:count"], ["rubro_id"]],
          { lazy: false }
        ).then(function (groups) {
          groups = Array.isArray(groups) ? groups : [];
          var rubroIdToCount = {};
          var rubroIds = [];
          groups.forEach(function (g) {
            var rid = (g.rubro_id && g.rubro_id[0]) || null;
            if (!rid) return;
            var cnt = g.id_count != null ? g.id_count : (g.__count || 0);
            rubroIdToCount[rid] = (rubroIdToCount[rid] || 0) + (cnt || 0);
            rubroIds.push(rid);
          });
          rubroIds = Array.from(new Set(rubroIds));

          function buildMapFromCounts(countsByCode) {
            var map = {};
            ALL_CODES.forEach(function (code) {
              var n = countsByCode[code] || countsByCode[toCode(code)] || 0;
              if (n > 0) map[code] = "ok";
              else if (code === "mano_obra" && ack.ack_mano_obra_empty) map[code] = "yellow";
              else if (code === "uniforme" && ack.ack_uniforme_empty) map[code] = "yellow";
              else map[code] = "red";
            });
            return map;
          }

          // Si no hubo grupos, intenta B) por rubro_code
          if (!rubroIds.length) {
            return callKw(
              "ccn.service.quote.line",
              "read_group",
              [[["quote_id", "=", resId]], ["id:count"], ["rubro_code"]],
              { lazy: false }
            ).then(function (groups2) {
              var countsByCode = {};
              (groups2 || []).forEach(function (g) {
                var code = g.rubro_code;
                if (!code) return;
                countsByCode[code] = (g.id_count != null ? g.id_count : (g.__count || 0)) || 0;
              });
              return buildMapFromCounts(countsByCode);
            }).catch(function(){ return null; });
          }

          // Hubo IDs: leer códigos desde ccn.service.rubro y mapear
          return callKw("ccn.service.rubro", "read", [rubroIds, ["code"]], {}).then(function (rubros) {
            var idToCode = {};
            (rubros || []).forEach(function (rb) { idToCode[rb.id] = rb.code; });
            var countsByCode = {};
            Object.keys(rubroIdToCount).forEach(function (ridStr) {
              var rid = parseInt(ridStr, 10);
              var code = idToCode[rid];
              if (!code) return;
              countsByCode[code] = (countsByCode[code] || 0) + (rubroIdToCount[rid] || 0);
            });
            // Si aun así quedó vacío, intenta B) por rubro_code
            if (Object.keys(countsByCode).length === 0) {
              return callKw(
                "ccn.service.quote.line",
                "read_group",
                [[["quote_id", "=", resId]], ["id:count"], ["rubro_code"]],
                { lazy: false }
              ).then(function (groups2) {
                (groups2 || []).forEach(function (g) {
                  var code = g.rubro_code;
                  if (!code) return;
                  countsByCode[code] = (g.id_count != null ? g.id_count : (g.__count || 0)) || 0;
                });
                return buildMapFromCounts(countsByCode);
              }).catch(function(){ return null; });
            }
            return buildMapFromCounts(countsByCode);
          });
        }).then(function (mapAorB) {
          return mapAorB || null;
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

      var byCode = {};
      links.forEach(function (a) {
        var raw = tabCode(a);
        if (!raw) return;
        byCode[toCode(raw)] = a;
      });

      // Inicial
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

      // Sólo cambios de contenido / ACK
      var dirty = {};
      var scheduled = false;
      function scheduleRepaint() {
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
        if (!pane || !pane.id) return null;
        var m = pane.id.match(/^page_(.+)$/);
        return m ? toCode(m[1]) : null;
      }

      var tabContent = notebook.querySelector(".tab-content") || notebook;
      var mo = new MutationObserver(function (mutations) {
        try {
          for (var i=0;i<mutations.length;i++) {
            var mut = mutations[i];
            var pane = (mut.target && mut.target.closest) ? mut.target.closest(".tab-pane") : null;
            if (pane) {
              var c = codeFromPane(pane);
              if (c && byCode[c]) dirty[c] = true;
            }
            var added = [].slice.call(mut.addedNodes || []);
            for (var j=0;j<added.length;j++) {
              var n = added[j];
              if (!(n && n.nodeType === 1)) continue;
              if (n.classList && n.classList.contains("tab-pane")) {
                var c1 = codeFromPane(n);
                if (c1 && byCode[c1]) dirty[c1] = true;
              } else {
                var p2 = n.closest && n.closest(".tab-pane");
                if (p2) {
                  var c2 = codeFromPane(p2);
                  if (c2 && byCode[c2]) dirty[c2] = true;
                }
              }
            }
          }
        } catch (e) {}
        if (Object.keys(dirty).length) scheduleRepaint();
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
          if (Object.keys(dirty).length) scheduleRepaint();
        } catch (e) {}
      });

      // Depuración opcional
      window.__ccnTabsLive = {
        repaint: function (code) {
          try {
            if (code && byCode[code]) {
              var a = byCode[code];
              var st = computeStateFor(a, code);
              clearTab(a);
              applyTabState(a, st);
              return;
            }
            Object.keys(byCode).forEach(function (c) {
              var a = byCode[c];
              var st = computeStateFor(a, c);
              clearTab(a);
              applyTabState(a, st);
            });
          } catch (e) {}
        }
      };
    });
  } catch (e) { /* nunca romper el cliente */ }
})();
