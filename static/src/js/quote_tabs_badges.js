/** CCN Quote Tabs Badges — Odoo 18 CE (sin imports)
 *  - Inicial: lee rubro_state_* (0=red, 1=ok, 2=yellow) desde ccn.service.quote.
 *  - Fallback: cuenta line_*_ids si los rubro_state_* no están disponibles.
 *  - Repinta solo ante cambios de contenido o ACK. No repinta al cambiar de pestaña.
 */

(function () {
  "use strict";

  /* ===== Mapeos ===== */

  // Códigos de rubro ↔ O2M (para repintado por contenido y fallback)
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

  // Campos de estado por rubro en el encabezado (lo que ya viste en shell)
  var STATE_FIELD_BY_CODE = {
    mano_obra: "rubro_state_mano_obra",
    uniforme: "rubro_state_uniforme",
    epp: "rubro_state_epp",
    epp_alturas: "rubro_state_epp_alturas",
    equipo_especial_limpieza: "rubro_state_equipo_especial_limpieza",
    comunicacion_computo: "rubro_state_comunicacion_computo",
    herramienta_menor_jardineria: "rubro_state_herramienta_menor_jardineria",
    material_limpieza: "rubro_state_material_limpieza",
    perfil_medico: "rubro_state_perfil_medico",
    maquinaria_limpieza: "rubro_state_maquinaria_limpieza",
    maquinaria_jardineria: "rubro_state_maquinaria_jardineria",
    fertilizantes_tierra_lama: "rubro_state_fertilizantes_tierra_lama",
    consumibles_jardineria: "rubro_state_consumibles_jardineria",
    capacitacion: "rubro_state_capacitacion",
  };

  // ACK sólo para estos dos (tu modelo)
  var ACK_BY_CODE = { mano_obra: "ack_mano_obra_empty", uniforme: "ack_uniforme_empty" };

  // Etiqueta visible de tab → código (para indexar aunque cambie el name/id del pane)
  function normalizeLabel(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");
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

  /* ===== Helpers de estilo ===== */
  function clsFor(st) { return st===1 ? "ccn-status-filled" : st===2 ? "ccn-status-ack" : "ccn-status-empty"; } // 0/1/2

  function clearTab(link){
    if(!link) return;
    var li = link.closest ? link.closest("li") : null;
    var rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove.apply(link.classList, rm);
    if(li) li.classList.remove.apply(li.classList, rm);
  }
  function applyTabState(link, numericState){
    if(!link) return;
    var li = link.closest ? link.closest("li") : null;
    var cls = clsFor(numericState);
    link.classList.add(cls);
    if(li) li.classList.add(cls);
  }

  /* ===== DOM utils ===== */
  function tabLabel(a){ return normalizeLabel(a ? a.textContent : ""); }

  function paneFor(link){
    if(!link) return null;
    var id=(link.getAttribute("aria-controls")||link.getAttribute("data-bs-target")||link.getAttribute("href")||"").replace(/^#/,"");
    return id ? document.getElementById(id) : null;
  }

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

  /* ===== JSON-RPC correcto ===== */
  function callKw(model, method, args, kwargs){
    var payload={jsonrpc:"2.0",method:"call",params:{model,method,args:args||[],kwargs:kwargs||{}},id:Date.now()};
    return fetch("/web/dataset/call_kw",{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload),
    }).then(r=>r.json()).then(j=>{ if(j&&j.error) throw j.error; return j?j.result:null; });
  }

  function getResId(){
    var el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    if (el) {
      var rid = parseInt(el.getAttribute("data-res-id"), 10);
      if (!isNaN(rid)) return rid;
    }
    var h = location.hash || "";
    var m = h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ===== Pintado inicial por rubro_state_* (fallback a O2M) ===== */

  function fetchInitialMapFromStates(resId){
    // lee todos los rubro_state_* de una
    var stateFields = ALL_CODES.map(c => STATE_FIELD_BY_CODE[c]).filter(Boolean);
    var ackFields = Object.values(ACK_BY_CODE);
    var fields = stateFields.concat(ackFields);

    return callKw("ccn.service.quote","read",[[resId], fields],{})
      .then(function (r){
        var rec = Array.isArray(r) ? r[0] : null;
        if (!rec) return null;

        var haveAnyState = stateFields.some(sf => rec.hasOwnProperty(sf) && rec[sf] !== false && rec[sf] !== null && rec[sf] !== undefined);

        if (!haveAnyState) return null; // no existen los campos → dejar que el caller haga fallback

        var map = {};
        ALL_CODES.forEach(function(code){
          var sf = STATE_FIELD_BY_CODE[code];
          var v = rec[sf];
          // valores esperados: 0|1|2 ; si viniera algo raro, tratamos como 0
          var n = (v===0 || v===1 || v===2) ? v : 0;
          // si el estado viniera 0 pero ACK está marcado (y aplica), forzamos 2 (amarillo)
          if (n === 0) {
            if (code === "mano_obra" && !!rec.ack_mano_obra_empty) n = 2;
            if (code === "uniforme" && !!rec.ack_uniforme_empty) n = 2;
          }
          map[code] = n;
        });
        return map;
      })
      .catch(function(){ return null; });
  }

  function fetchInitialMapFallbackO2M(resId){
    // Leer los length de los line_*_ids en un solo read
    var o2mFields = ALL_CODES.map(c => O2M_BY_CODE[c]);
    var ackFields = Object.values(ACK_BY_CODE);
    var fields = o2mFields.concat(ackFields);
    return callKw("ccn.service.quote","read",[[resId], fields],{})
      .then(function (r){
        var rec = Array.isArray(r) ? r[0] : null;
        if (!rec) return null;
        var map = {};
        ALL_CODES.forEach(function(code){
          var arr = rec[ O2M_BY_CODE[code] ] || [];
          var n = Array.isArray(arr) ? arr.length : 0;
          if (n > 0) map[code] = 1; // ok
          else if (code === "mano_obra" && !!rec.ack_mano_obra_empty) map[code] = 2;
          else if (code === "uniforme" && !!rec.ack_uniforme_empty) map[code] = 2;
          else map[code] = 0;
        });
        return map;
      })
      .catch(function(){ return null; });
  }

  /* ===== Repintado por cambios de contenido / ACK (DOM) ===== */

  function computeStateFromDom(link, code){
    try{
      var rows = countRowsInPane(paneFor(link), O2M_BY_CODE[code]);
      if (rows > 0) return 1; // ok
      var ackField = ACK_BY_CODE[code];
      if (ackField && readAckFromDom(ackField)) return 2; // amarillo
      return 0; // rojo
    }catch(e){ return 0; }
  }

  /* ===== Arranque ===== */

  function waitNotebook(cb){
    var nb = document.querySelector(".o_form_view .o_notebook");
    if (nb) return cb(nb);
    var mo = new MutationObserver(function(){
      var n = document.querySelector(".o_form_view .o_notebook");
      if (n) { mo.disconnect(); cb(n); }
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  try {
    waitNotebook(function (notebook){
      var links = [].slice.call(notebook.querySelectorAll(".nav-tabs .nav-link"));
      if (!links.length) return;

      // Indexar TABS por etiqueta y por nombre de pane (page_<code>)
      var byCode = {};
      links.forEach(function (a){
        var lbl = tabLabel(a);
        var codeFromLabel = LABEL_TO_CODE[lbl];
        if (codeFromLabel) byCode[codeFromLabel] = a;

        // extra: si el href/name tiene page_<code>
        var nameAttr = a.getAttribute("name") || (a.dataset ? a.dataset.name : "") || "";
        var m = nameAttr.match(/^page_(.+)$/);
        var raw = m ? m[1] : ((a.getAttribute("aria-controls") || a.getAttribute("data-bs-target") || a.getAttribute("href") || "").replace(/^#/,"") || "");
        var m2 = raw.match(/^page_(.+)$/);
        if (m2 && O2M_BY_CODE[m2[1]]) byCode[m2[1]] = byCode[m2[1]] || a;
      });

      var resId = getResId();

      // Pintado inicial: primero intentamos rubro_state_*, si no, fallback a O2M.
      (resId ? fetchInitialMapFromStates(resId) : Promise.resolve(null))
        .then(function (mapStates){
          if (mapStates) return mapStates;
          if (!resId) return null;
          return fetchInitialMapFallbackO2M(resId);
        })
        .then(function (initialMap){
          try {
            Object.keys(byCode).forEach(function (code){
              var a = byCode[code];
              clearTab(a);
              var st = (initialMap && (initialMap[code] === 0 || initialMap[code] === 1 || initialMap[code] === 2))
                ? initialMap[code]
                : computeStateFromDom(a, code);
              applyTabState(a, st);
            });
          } catch (e) {}
        });

      // Repintar sólo ante cambios de contenido / ACK
      var dirty = {}; var scheduled = false;
      function schedule(){
        if (scheduled) return;
        scheduled = true;
        setTimeout(function(){
          scheduled = false;
          try {
            Object.keys(dirty).forEach(function (code){
              var a = byCode[code];
              if (!a) return;
              var st = computeStateFromDom(a, code);
              clearTab(a); applyTabState(a, st);
            });
          } catch (e) {}
          dirty = {};
        }, 60);
      }

      function codeFromPane(pane){
        if (!pane) return null;
        // detecta por presencia del o2m
        for (var code in O2M_BY_CODE){
          var o2m = O2M_BY_CODE[code];
          if (pane.querySelector('[name="'+o2m+'"], [data-name="'+o2m+'"]')) return code;
        }
        return null;
      }

      var tabContent = notebook.querySelector(".tab-content") || notebook;
      var mo = new MutationObserver(function (muts){
        try{
          for (var i=0;i<muts.length;i++){
            var mut = muts[i];
            var pane = (mut.target && mut.target.closest) ? mut.target.closest(".tab-pane") : null;
            if (pane) {
              var c = codeFromPane(pane);
              if (c && byCode[c]) dirty[c] = true;
            }
            var added = [].slice.call(mut.addedNodes || []);
            for (var j=0;j<added.length;j++){
              var n = added[j];
              if (!(n && n.nodeType === 1)) continue;
              var p2 = n.classList && n.classList.contains("tab-pane") ? n : (n.closest && n.closest(".tab-pane"));
              if (p2) {
                var c2 = codeFromPane(p2);
                if (c2 && byCode[c2]) dirty[c2] = true;
              }
            }
          }
        }catch(e){}
        if (Object.keys(dirty).length) schedule();
      });
      mo.observe(tabContent, { childList:true, subtree:true });

      document.addEventListener("change", function (ev){
        try{
          var nm = ev.target && ev.target.getAttribute && ev.target.getAttribute("name");
          if (!nm) return;
          Object.keys(ACK_BY_CODE).forEach(function (code){
            if (nm === ACK_BY_CODE[code] && byCode[code]) {
              dirty[code] = true;
            }
          });
          if (Object.keys(dirty).length) schedule();
        }catch(e){}
      });

      // Depuración opcional
      window.__ccnTabsLive = {
        repaint: function (code) {
          try{
            if (code && byCode[code]){
              var a = byCode[code];
              var st = computeStateFromDom(a, code);
              clearTab(a); applyTabState(a, st);
              return;
            }
            Object.keys(byCode).forEach(function (c){
              var a = byCode[c];
              var st = computeStateFromDom(a, c);
              clearTab(a); applyTabState(a, st);
            });
          }catch(e){}
        }
      };
    });
  } catch (e) { /* nunca romper el cliente */ }
})();
