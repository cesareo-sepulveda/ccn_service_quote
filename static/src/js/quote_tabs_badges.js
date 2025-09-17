/** CCN Quote Tabs — pinta por rubro_state_* (RPC) y ajusta ante cambios no guardados.
 * Odoo 18 CE, sin imports. No toca tu SCSS/chevrons.
 * Reglas:
 *   state 1 => ccn-status-filled (verde)
 *   state 2 => ccn-status-ack   (ámbar)
 *   state 0 => ccn-status-empty (rojo)
 */

(function () {
  "use strict";

  // ---- Códigos de rubro (usa exactamente los del modelo) ----
  const CODES = [
    "mano_obra","uniforme","epp","epp_alturas","equipo_especial_limpieza",
    "comunicacion_computo","herramienta_menor_jardineria","material_limpieza",
    "perfil_medico","maquinaria_limpieza","maquinaria_jardineria",
    "fertilizantes_tierra_lama","consumibles_jardineria","capacitacion",
  ];

  // label visible → code (por si necesitamos fallback por texto)
  function norm(s){return String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/\s+/g," ");}
  const LABEL_TO_CODE = {
    "mano de obra":"mano_obra","uniforme":"uniforme","epp":"epp","epp alturas":"epp_alturas",
    "equipo especial de limpieza":"equipo_especial_limpieza","comunicacion y computo":"comunicacion_computo",
    "herr. menor jardineria":"herramienta_menor_jardineria","herramienta menor jardineria":"herramienta_menor_jardineria",
    "material de limpieza":"material_limpieza","perfil medico":"perfil_medico","maquinaria limpieza":"maquinaria_limpieza",
    "maquinaria de jardineria":"maquinaria_jardineria","maquinaria jardineria":"maquinaria_jardineria",
    "fertilizantes y tierra lama":"fertilizantes_tierra_lama","consumibles de jardineria":"consumibles_jardineria",
    "consumibles jardineria":"consumibles_jardineria","capacitacion":"capacitacion",
  };

  // rubro_state_* y ack_* names
  const STATE_FIELD = (code) => `rubro_state_${code}`;
  const ACK_FIELD = (code) => ({
    mano_obra:"ack_mano_obra_empty", uniforme:"ack_uniforme_empty", epp:"ack_epp_empty",
    epp_alturas:"ack_epp_alturas_empty", equipo_especial_limpieza:"ack_equipo_especial_limpieza_empty",
    comunicacion_computo:"ack_comunicacion_computo_empty", herramienta_menor_jardineria:"ack_herramienta_menor_jardineria_empty",
    material_limpieza:"ack_material_limpieza_empty", perfil_medico:"ack_perfil_medico_empty",
    maquinaria_limpieza:"ack_maquinaria_limpieza_empty", maquinaria_jardineria:"ack_maquinaria_jardineria_empty",
    fertilizantes_tierra_lama:"ack_fertilizantes_tierra_lama_empty", consumibles_jardineria:"ack_consumibles_jardineria_empty",
    capacitacion:"ack_capacitacion_empty",
  }[code]);

  // ===== Estilo =====
  function clsFor(s){return s===1?"ccn-status-filled":s===2?"ccn-status-ack":"ccn-status-empty";}
  function clearTab(a){ if(!a) return; const li=a.closest?.("li"); const rm=["ccn-status-filled","ccn-status-ack","ccn-status-empty"]; a.classList.remove(...rm); li&&li.classList.remove(...rm); }
  function applyTab(a, st){ if(!a) return; const li=a.closest?.("li"); const c=clsFor(st); a.classList.add(c); li&&li.classList.add(c); }

  // ===== DOM helpers =====
  function paneFor(a){
    if(!a) return null;
    const id=(a.getAttribute("aria-controls")||a.getAttribute("data-bs-target")||a.getAttribute("href")||"").replace(/^#/,"");
    return id?document.getElementById(id):null;
  }
  function linksInNotebook(nb){ return [...nb.querySelectorAll(".nav-tabs .nav-link")]; }

  // ===== Conteo DOM (cambios no guardados) =====
  function countRows(pane){
    if(!pane) return 0;
    let t=0;
    // List
    pane.querySelectorAll(".o_list_renderer tbody, .o_list_view tbody").forEach(tb=>{
      t += tb.querySelectorAll("tr.o_data_row, tr[data-id], tr[role='row'][data-id], tr[aria-rowindex]").length;
    });
    // Kanban
    pane.querySelectorAll(".o_kanban_renderer, .o_kanban_view").forEach(k=>{
      t += k.querySelectorAll(".o_kanban_record, .oe_kanban_card, [data-id].o_kanban_record").length;
    });
    return t;
  }
  function readAckDOM(field){
    const cb=document.querySelector(`input[name="${field}"]`)||document.querySelector(`[name="${field}"] .o_checkbox input`);
    if(cb && "checked" in cb) return !!cb.checked;
    const el=document.querySelector(`[name="${field}"], [data-name="${field}"]`);
    const raw=el?.getAttribute("data-value")||el?.getAttribute("value")||el?.textContent||"";
    const s=String(raw).trim().toLowerCase(); return s==="1"||s==="true"||s==="yes"||s==="sí"||s==="si";
  }

  // ===== RPC =====
  function callKw(model, method, args, kwargs){
    const payload={jsonrpc:"2.0",method:"call",params:{model,method,args:args||[],kwargs:kwargs||{}},id:Date.now()};
    return fetch("/web/dataset/call_kw",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)})
      .then(r=>r.json()).then(j=>{ if(j.error) throw j.error; return j.result; });
  }
  function getResId(){
    const el=document.querySelector('.o_form_view[data-res-model="ccn.service.quote"][data-res-id]');
    if(el){const id=parseInt(el.getAttribute("data-res-id"),10); if(!isNaN(id)) return id;}
    const m=(location.hash||"").match(/[?&#](?:id|res_id|active_id)=([0-9]+)/);
    return m?parseInt(m[1],10):null;
  }

  // ===== Pintado inicial por rubro_state_* =====
  function initialPaint(nb, byCode){
    const id=getResId(); if(!id) return Promise.resolve();
    const fields = CODES.map(STATE_FIELD).concat(CODES.map(ACK_FIELD));
    return callKw("ccn.service.quote","read",[[id],fields],{}).then(res=>{
      const rec = Array.isArray(res)?res[0]:null; if(!rec) return;
      for(const code of Object.keys(byCode)){
        const a = byCode[code];
        const st = rec[STATE_FIELD(code)];
        clearTab(a); applyTab(a, (st===0||st===1||st===2)?st:0);
      }
    }).catch(()=>{ /* si falla RPC, no pintamos aquí */});
  }

  // ===== Observadores (sólo cuando cambia contenido/ACK) =====
  function setupObservers(nb, byCode){
    const tabContent = nb.querySelector(".tab-content")||nb;
    let dirty={}; let scheduled=false;
    function schedule(){
      if(scheduled) return; scheduled=true;
      setTimeout(()=>{ scheduled=false;
        try{
          Object.keys(dirty).forEach(code=>{
            const a=byCode[code]; if(!a) return;
            const pane=paneFor(a);
            const rows=countRows(pane);
            const ack=readAckDOM(ACK_FIELD(code));
            const st = rows>0 ? 1 : (ack?2:0);
            clearTab(a); applyTab(a, st);
          });
        }catch{}
        dirty={};
      },60);
    }

    const mo=new MutationObserver(muts=>{
      try{
        for(const mut of muts){
          const pane = mut.target?.closest?.(".tab-pane");
          const proc = (p)=>{ if(!p) return;
            for(const [code,a] of Object.entries(byCode)){
              const pp=paneFor(a); if(pp && pp===p){ dirty[code]=true; break; }
            }
          };
          if(pane) proc(pane);
          for(const n of mut.addedNodes||[]){
            if(!(n instanceof Element)) continue;
            const p2 = n.classList?.contains("tab-pane")?n:n.closest?.(".tab-pane");
            if(p2) proc(p2);
          }
        }
      }catch{}
      if(Object.keys(dirty).length) schedule();
    });
    mo.observe(tabContent,{childList:true,subtree:true});

    document.addEventListener("change",ev=>{
      try{
        const nm=ev.target?.getAttribute?.("name");
        if(!nm) return;
        for(const code of CODES){ if(nm===ACK_FIELD(code) && byCode[code]) dirty[code]=true; }
        if(Object.keys(dirty).length) schedule();
      }catch{}
    });
  }

  // ===== Arranque =====
  function waitNotebook(cb){
    const nb=document.querySelector(".o_form_view .o_notebook");
    if(nb) return cb(nb);
    const mo=new MutationObserver(()=>{ const n=document.querySelector(".o_form_view .o_notebook"); if(n){mo.disconnect(); cb(n);} });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  try{
    waitNotebook(function(nb){
      const links = linksInNotebook(nb);
      if(!links.length) return;

      // Construir índice: por etiqueta visible y por fallback de orden
      const byCode = {};
      // 1) por etiqueta
      for(const a of links){
        const code = LABEL_TO_CODE[norm(a.textContent)];
        if(code) byCode[code]=a;
      }
      // 2) si algún code faltó, asigna por posición (asumiendo orden de tabs = orden de CODES)
      if(Object.keys(byCode).length<links.length){
        const unused = new Set(CODES.filter(c=>!byCode[c]));
        for(const a of links){
          const already = Object.values(byCode).includes(a); if(already) continue;
          const code = unused.values().next().value; if(!code) break;
          byCode[code]=a; unused.delete(code);
        }
      }

      // Pintado inicial por rubro_state_*
      initialPaint(nb, byCode).finally(()=>{
        // Ajustes sólo cuando realmente cambie algo en el contenido
        setupObservers(nb, byCode);
      });

      // Depuración
      window.__ccnTabsState = {
        dump(){
          const out = {}; for(const [c,a] of Object.entries(byCode)){ const li=a.closest("li");
            out[c]={tab:a.textContent.trim(), classes:[...new Set([...[...a.classList], ...(li?[...li.classList]:[])])].filter(k=>/^ccn-status-/.test(k))};
          } console.table(out);
        }
      };
    });
  }catch{}
})();
