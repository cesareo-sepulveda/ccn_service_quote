/** CCN Quote Tabs Badges — ACK para todos los rubros (Odoo 18 CE, sin imports)
 *  - Pintado inicial rápido: JSON-RPC read() de todos los line_*_ids + todos los ack_*_empty
 *  - Reglas: >0 filas => verde ; 0 filas + ACK => ámbar ; 0 filas sin ACK => rojo
 *  - Repinta solo en cambios de contenido o cambios de ACK; no repinta al cambiar de pestaña
 */

(function () {
  "use strict";

  // ====== Mapeos ======
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
  const ALL_CODES = Object.keys(O2M_BY_CODE);

  const ACK_BY_CODE = {
    mano_obra: "ack_mano_obra_empty",
    uniforme: "ack_uniforme_empty",
    epp: "ack_epp_empty",
    epp_alturas: "ack_epp_alturas_empty",
    equipo_especial_limpieza: "ack_equipo_especial_limpieza_empty",
    comunicacion_computo: "ack_comunicacion_computo_empty",
    herramienta_menor_jardineria: "ack_herramienta_menor_jardineria_empty",
    material_limpieza: "ack_material_limpieza_empty",
    perfil_medico: "ack_perfil_medico_empty",
    maquinaria_limpieza: "ack_maquinaria_limpieza_empty",
    maquinaria_jardineria: "ack_maquinaria_jardineria_empty",
    fertilizantes_tierra_lama: "ack_fertilizantes_tierra_lama_empty",
    consumibles_jardineria: "ack_consumibles_jardineria_empty",
    capacitacion: "ack_capacitacion_empty",
  };

  function norm(s){
    return String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/\s+/g," ");
  }
  const LABEL_TO_CODE = {
    "mano de obra":"mano_obra",
    "uniforme":"uniforme",
    "epp":"epp",
    "epp alturas":"epp_alturas",
    "equipo especial de limpieza":"equipo_especial_limpieza",
    "comunicacion y computo":"comunicacion_computo",
    "herr. menor jardineria":"herramienta_menor_jardineria",
    "herramienta menor jardineria":"herramienta_menor_jardineria",
    "material de limpieza":"material_limpieza",
    "perfil medico":"perfil_medico",
    "maquinaria limpieza":"maquinaria_limpieza",
    "maquinaria de jardineria":"maquinaria_jardineria",
    "maquinaria jardineria":"maquinaria_jardineria",
    "fertilizantes y tierra lama":"fertilizantes_tierra_lama",
    "consumibles de jardineria":"consumibles_jardineria",
    "consumibles jardineria":"consumibles_jardineria",
    "capacitacion":"capacitacion",
  };

  // ====== Estilo ======
  function clsFor(st){ return st==="ok"?"ccn-status-filled":st==="yellow"?"ccn-status-ack":"ccn-status-empty"; }
  function clearTab(link){
    if(!link) return;
    const li=link.closest?link.closest("li"):null;
    const rm=["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove(...rm);
    if(li) li.classList.remove(...rm);
  }
  function applyTabState(link, state){
    if(!link) return;
    const li=link.closest?link.closest("li"):null;
    const c=clsFor(state);
    link.classList.add(c);
    if(li) li.classList.add(c);
  }

  // ====== DOM utils ======
  function paneFor(link){
    if(!link) return null;
    const id=(link.getAttribute("aria-controls")||link.getAttribute("data-bs-target")||link.getAttribute("href")||"").replace(/^#/, "");
    return id?document.getElementById(id):null;
  }
  function countRowsGeneric(pane){
    if(!pane) return 0;
    let total=0;
    pane.querySelectorAll(".o_list_renderer tbody, .o_list_view tbody").forEach(tb=>{
      total+=tb.querySelectorAll("tr.o_data_row, tr[data-id], tr[role='row'][data-id]").length;
    });
    pane.querySelectorAll(".o_kanban_renderer, .o_kanban_view").forEach(k=>{
      total+=k.querySelectorAll(".o_kanban_record, .oe_kanban_card, [data-id].o_kanban_record").length;
    });
    return total;
  }
  function readAckFromDom(fieldName){
    const cb = document.querySelector(`input[name="${fieldName}"]`) ||
               document.querySelector(`[name="${fieldName}"] .o_checkbox input`);
    if (cb && "checked" in cb) return !!cb.checked;
    const el = document.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if (!el) return false;
    const raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
    const s = String(raw).trim().toLowerCase();
    return (s==="1"||s==="true"||s==="yes"||s==="sí"||s==="si");
  }

  // ====== JSON-RPC (formato correcto) ======
  function callKw(model, method, args, kwargs){
    const payload={jsonrpc:"2.0",method:"call",params:{model,method,args:args||[],kwargs:kwargs||{}},id:Date.now()};
    return fetch("/web/dataset/call_kw",{
      method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload),
    }).then(r=>r.json()).then(j=>{ if(j&&j.error) throw j.error; return j?j.result:null; });
  }
  function getResId(){
    const el=document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    if (el) { const rid=parseInt(el.getAttribute("data-res-id"),10); if(!isNaN(rid)) return rid; }
    const h=location.hash||""; const m=h.match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    return m?parseInt(m[1],10):null;
  }

  // ====== Pintado inicial rápido (read de O2M + ACKs) ======
  function fetchInitialMap(resId){
    if(!resId) return Promise.resolve(null);
    const o2mFields = ALL_CODES.map(c=>O2M_BY_CODE[c]);
    const ackFields = Object.values(ACK_BY_CODE);
    const fields = o2mFields.concat(ackFields);
    return callKw("ccn.service.quote","read",[[resId], fields],{}).then(r=>{
      const rec = Array.isArray(r) ? r[0] : null;
      if(!rec) return null;
      const map={};
      ALL_CODES.forEach(code=>{
        const arr = rec[ O2M_BY_CODE[code] ] || [];
        const n = Array.isArray(arr) ? arr.length : 0;
        const ackField = ACK_BY_CODE[code];
        const ack = ackField ? !!rec[ackField] : false;
        if (n > 0) map[code] = "ok";
        else map[code] = ack ? "yellow" : "red";
      });
      return map;
    }).catch(()=>null);
  }

  // ====== Repintado por cambios reales ======
  function stateFromDom(pane, code){
    const rows = countRowsGeneric(pane);
    if (rows > 0) return "ok";
    const ackField = ACK_BY_CODE[code];
    if (ackField && readAckFromDom(ackField)) return "yellow";
    return "red";
  }

  // ====== Arranque ======
  function waitNotebook(cb){
    const nb=document.querySelector(".o_form_view .o_notebook");
    if(nb) return cb(nb);
    const mo=new MutationObserver(()=>{
      const n=document.querySelector(".o_form_view .o_notebook");
      if(n){ mo.disconnect(); cb(n); }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  try{
    waitNotebook(function(notebook){
      const links=[...notebook.querySelectorAll(".nav-tabs .nav-link")];
      if(!links.length) return;

      // Indexar tabs por etiqueta visible
      const byCode={};
      for(const a of links){
        const code = LABEL_TO_CODE[norm(a.textContent)];
        if (code) byCode[code]=a;
      }

      // Pintado inicial vía read()
      const resId=getResId();
      fetchInitialMap(resId).then(initialMap=>{
        try{
          Object.keys(byCode).forEach(code=>{
            const a=byCode[code];
            clearTab(a);
            const pane = paneFor(a);
            const st = (initialMap && initialMap[code]) || stateFromDom(pane, code);
            applyTabState(a, st);
          });
        }catch(e){}
      });

      // Observador de cambios de contenido (solo repinta lo afectado)
      const tabContent = notebook.querySelector(".tab-content") || notebook;
      let dirty={}; let scheduled=false;
      const schedule=()=>{ if(scheduled) return; scheduled=true; setTimeout(()=>{ scheduled=false;
        try{
          Object.keys(dirty).forEach(code=>{
            const a=byCode[code]; if(!a) return;
            const pane=paneFor(a);
            const st=stateFromDom(pane, code);
            clearTab(a); applyTabState(a, st);
          });
        }catch(e){}
        dirty={};
      }, 60); };

      const mo=new MutationObserver(muts=>{
        try{
          for(const mut of muts){
            const pane = mut.target?.closest?.(".tab-pane");
            if (pane) {
              // deducir código por el link cuyo pane sea este
              for (const [code, a] of Object.entries(byCode)) {
                const p = paneFor(a);
                if (p && p === pane) { dirty[code]=true; break; }
              }
            }
            for (const n of mut.addedNodes || []) {
              if (!(n instanceof Element)) continue;
              const p2 = n.classList?.contains("tab-pane") ? n : n.closest?.(".tab-pane");
              if (p2) {
                for (const [code, a] of Object.entries(byCode)) {
                  const p = paneFor(a);
                  if (p && p === p2) { dirty[code]=true; break; }
                }
              }
            }
          }
        }catch(e){}
        if(Object.keys(dirty).length) schedule();
      });
      mo.observe(tabContent,{childList:true,subtree:true});

      // Cambios de ACK → repintar solo ese rubro
      document.addEventListener("change", ev=>{
        try{
          const nm = ev.target?.getAttribute?.("name");
          if(!nm) return;
          for(const [code, field] of Object.entries(ACK_BY_CODE)){
            if (nm === field && byCode[code]) { dirty[code]=true; }
          }
          if(Object.keys(dirty).length) schedule();
        }catch(e){}
      });

      // Depuración opcional
      window.__ccnTabsLive = {
        repaint(code){
          try{
            if(code && byCode[code]){
              const a=byCode[code];
              const st=stateFromDom(paneFor(a), code);
              clearTab(a); applyTabState(a, st);
              return;
            }
            Object.keys(byCode).forEach(c=>{
              const a=byCode[c];
              const st=stateFromDom(paneFor(a), c);
              clearTab(a); applyTabState(a, st);
            });
          }catch(e){}
        }
      };
    });
  }catch(e){}
})();
