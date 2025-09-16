/** CCN Quote Tabs Badges — inicial por read() de One2many, sin imports (Odoo 18 CE)
 *  - Lee de una vez: todos los line_*_ids + ACKs en ccn.service.quote.
 *  - Pinta al inicio según longitud de cada O2M.
 *  - Luego repinta solo ante cambios de contenido o ACK.
 */

(function () {
  "use strict";

  /* ==== Mapeo: código de pestaña ↔ nombre del One2many en el encabezado ==== */
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

  function clsFor(st){ return st==="ok"?"ccn-status-filled":st==="yellow"?"ccn-status-ack":"ccn-status-empty"; }

  function tabCode(a){
    if(!a) return null;
    var n = a.getAttribute("name") || (a.dataset?a.dataset.name:"") || "";
    var m = n.match(/^page_(.+)$/); if(m) return m[1];
    var t = (a.getAttribute("aria-controls")||a.getAttribute("data-bs-target")||a.getAttribute("href")||"").replace(/^#/,"");
    m = t.match(/^page_(.+)$/); return m?m[1]:null;
  }
  function paneFor(link){
    var id=(link.getAttribute("aria-controls")||link.getAttribute("data-bs-target")||link.getAttribute("href")||"").replace(/^#/,"");
    return id?document.getElementById(id):null;
  }
  function clearTab(link){
    if(!link) return;
    var li = link.closest?link.closest("li"):null;
    var rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove.apply(link.classList, rm);
    if(li) li.classList.remove.apply(li.classList, rm);
  }
  function applyTabState(link, state){
    if(!link) return;
    var li = link.closest?link.closest("li"):null;
    var cls = clsFor(state);
    link.classList.add(cls);
    if(li) li.classList.add(cls);
  }
  function getResId(){
    var el = document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    if(el){ var rid=parseInt(el.getAttribute("data-res-id"),10); if(!isNaN(rid)) return rid; }
    var h=location.hash||""; var m=h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    return m?parseInt(m[1],10):null;
  }

  /* ===== JSON-RPC helper (formato correcto) ===== */
  function callKw(model, method, args, kwargs){
    var payload={jsonrpc:"2.0",method:"call",params:{model,method,args:args||[],kwargs:kwargs||{}},id:Date.now()};
    return fetch("/web/dataset/call_kw",{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload),
    }).then(r=>r.json()).then(j=>{ if(j&&j.error) throw j.error; return j?j.result:null; });
  }

  /* ===== Pintado inicial leyendo One2many + ACK con read() ===== */
  function fetchInitialMap(resId){
    if(!resId) return Promise.resolve(null);
    var fields = ALL_CODES.map(c=>O2M_BY_CODE[c]).concat(Object.values(ACK_BY_CODE));
    return callKw("ccn.service.quote","read",[[resId], fields],{}).then(function(r){
      var rec = Array.isArray(r)?r[0]:null; if(!rec) return null;
      var map = {};
      ALL_CODES.forEach(function(code){
        var field = O2M_BY_CODE[code];
        var arr = rec[field] || [];
        var n = Array.isArray(arr)?arr.length:0;
        if(n>0) map[code]="ok";
        else if(code==="mano_obra" && !!rec.ack_mano_obra_empty) map[code]="yellow";
        else if(code==="uniforme" && !!rec.ack_uniforme_empty) map[code]="yellow";
        else map[code]="red";
      });
      return map;
    }).catch(function(){ return null; });
  }

  /* ===== Repintado por cambios de contenido / ACK ===== */
  function countRowsInPane(pane, o2mName){
    if(!pane||!o2mName) return 0;
    var box=pane.querySelector('[name="'+o2mName+'"], [data-name="'+o2mName+'"]'); if(!box) return 0;
    var tbody=box.querySelector(".o_list_view tbody"); if(tbody) return tbody.querySelectorAll("tr.o_data_row, tr[data-id]").length;
    var kan=box.querySelector(".o_kanban_view"); if(kan) return kan.querySelectorAll(".o_kanban_record, .oe_kanban_card").length;
    return 0;
  }
  function readAckFromDom(fieldName){
    var cb = document.querySelector('input[name="'+fieldName+'"]') || document.querySelector('[name="'+fieldName+'"] .o_checkbox input');
    if(cb && "checked" in cb) return !!cb.checked;
    var el = document.querySelector('[name="'+fieldName+'"], [data-name="'+fieldName+'"]'); if(!el) return false;
    var raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
    var s = String(raw).trim().toLowerCase(); return (s==="1"||s==="true"||s==="yes"||s==="sí"||s==="si");
  }
  function computeStateFor(link, code){
    try{
      var pane=paneFor(link); var o2m=O2M_BY_CODE[code]; var rows=countRowsInPane(pane,o2m);
      if(rows>0) return "ok";
      var ackField = ACK_BY_CODE[code]; if(ackField && readAckFromDom(ackField)) return "yellow";
      return "red";
    }catch(e){ return "red"; }
  }

  /* ===== Arranque ===== */
  function waitNotebook(cb){
    var nb=document.querySelector(".o_form_view .o_notebook"); if(nb) return cb(nb);
    var mo=new MutationObserver(function(){
      var n=document.querySelector(".o_form_view .o_notebook"); if(n){ mo.disconnect(); cb(n); }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  try{
    waitNotebook(function(notebook){
      var links=[].slice.call(notebook.querySelectorAll(".nav-tabs .nav-link")); if(!links.length) return;

      var byCode={};
      links.forEach(function(a){ var raw=tabCode(a); if(!raw) return; byCode[raw]=a; });

      // Pintado inicial vía read()
      var resId=getResId();
      fetchInitialMap(resId).then(function(initialMap){
        try{
          Object.keys(byCode).forEach(function(code){
            var a=byCode[code];
            clearTab(a);
            var st = (initialMap && initialMap[code]) || computeStateFor(a, code);
            applyTabState(a, st);
          });
        }catch(e){}
      });

      // Solo repintar cuando cambie contenido o ACK
      var dirty={}; var scheduled=false;
      function schedule(){ if(scheduled) return; scheduled=true; setTimeout(function(){
        scheduled=false;
        try{
          Object.keys(dirty).forEach(function(code){
            var a=byCode[code]; if(!a) return;
            var st=computeStateFor(a, code);
            clearTab(a); applyTabState(a, st);
          });
        }catch(e){}
        dirty={};
      },60); }

      function codeFromPane(pane){ if(!pane||!pane.id) return null; var m=pane.id.match(/^page_(.+)$/); return m?m[1]:null; }

      var tabContent=notebook.querySelector(".tab-content")||notebook;
      var mo=new MutationObserver(function(muts){
        try{
          for(var i=0;i<muts.length;i++){
            var mut=muts[i];
            var pane=(mut.target&&mut.target.closest)?mut.target.closest(".tab-pane"):null;
            if(pane){ var c=codeFromPane(pane); if(c&&byCode[c]) dirty[c]=true; }
            var added=[].slice.call(mut.addedNodes||[]);
            for(var j=0;j<added.length;j++){
              var n=added[j]; if(!(n&&n.nodeType===1)) continue;
              if(n.classList&&n.classList.contains("tab-pane")){
                var c1=codeFromPane(n); if(c1&&byCode[c1]) dirty[c1]=true;
              }else{
                var p2=n.closest&&n.closest(".tab-pane"); if(p2){ var c2=codeFromPane(p2); if(c2&&byCode[c2]) dirty[c2]=true; }
              }
            }
          }
        }catch(e){}
        if(Object.keys(dirty).length) schedule();
      });
      mo.observe(tabContent,{childList:true,subtree:true});

      document.addEventListener("change", function(ev){
        try{
          var nm=ev.target&&ev.target.getAttribute&&ev.target.getAttribute("name"); if(!nm) return;
          Object.keys(ACK_BY_CODE).forEach(function(code){
            if(nm===ACK_BY_CODE[code] && byCode[code]){ dirty[code]=true; }
          });
          if(Object.keys(dirty).length) schedule();
        }catch(e){}
      });

      // Depuración opcional
      window.__ccnTabsLive = {
        repaint: function (code) {
          try{
            if(code && byCode[code]){
              var a=byCode[code]; var st=computeStateFor(a, code);
              clearTab(a); applyTabState(a, st); return;
            }
            Object.keys(byCode).forEach(function(c){
              var a=byCode[c]; var st=computeStateFor(a, c);
              clearTab(a); applyTabState(a, st);
            });
          }catch(e){}
        }
      };
    });
  }catch(e){ /* nunca rompemos el cliente */ }
})();
