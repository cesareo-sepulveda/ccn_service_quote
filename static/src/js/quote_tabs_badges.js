(function () {
  "use strict";

  // Normaliza etiquetas visibles de pestañas -> minúsculas sin acentos/espacios dobles
  function norm(s){
    return String(s||"").trim().toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/\s+/g," ");
  }

  // Mapeo etiqueta -> código de rubro (todas las pestañas del form)
  const LABEL_TO_CODE = {
    "mano de obra": "mano_obra",
    "uniforme": "uniforme",
    "epp": "epp",
    "epp alturas": "epp_alturas",
    "equipo especial de limpieza": "equipo_especial_limpieza",
    "comunicacion y computo": "comunicacion_computo",
    "herr. menor jardineria": "herramienta_menor_jardineria",
    "material de limpieza": "material_limpieza",
    "perfil medico": "perfil_medico",
    "maquinaria de limpieza": "maquinaria_limpieza",
    "maquinaria de jardineria": "maquinaria_jardineria",
    "fertilizantes y tierra lama": "fertilizantes_tierra_lama",
    "consumibles de jardineria": "consumibles_jardineria",
    "capacitacion": "capacitacion",
  };

  function LABEL_TOCODE_SAFE(){ return LABEL_TO_CODE; }
  const STATE_FIELD = (code) => `rubro_state_${code}`;

  // Clases de color
  function clsFor(st){
    return st === 1 ? "ccn-status-filled"
         : st === 2 ? "ccn-status-ack"
         : "ccn-status-empty";
  }
  function clearTab(link){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const rm = ["ccn-status-filled","ccn-status-ack","ccn-status-empty"];
    link.classList.remove(...rm);
    li && li.classList.remove(...rm);
  }
  function applyTab(link, st){
    if(!link) return;
    const li = link.closest ? link.closest("li") : null;
    const c = clsFor(st);
    if (link.classList.contains(c) || (li && li.classList.contains(c))) return;
    clearTab(link);
    link.classList.add(c);
    li && li.classList.add(c);
  }

  // Lee el valor entero del campo (renderizado en el DOM, aunque esté oculto por CSS)
  function readIntField(root, fieldName){
    // Campos renderizados con name= o data-name=
    const el = root.querySelector(`[name="${fieldName}"], [data-name="${fieldName}"]`);
    if(!el) return null;
    const raw = el.getAttribute("data-value") ?? el.getAttribute("value") ?? el.textContent;
    if(raw == null) return null;
    const v = parseInt(String(raw).trim(), 10);
    return Number.isNaN(v) ? null : v;
  }

  // Notebook y tabs
  function getNotebook(){ return document.querySelector(".o_form_view .o_notebook"); }
  function getLinks(nb){ return nb ? [...nb.querySelectorAll(".nav-tabs .nav-link")] : []; }

  // Índice code -> <a.nav-link>
  function indexByCode(nb){
    const byCode = {};
    if(!nb) return byCode;
    for(const a of getLinks(nb)){
      const code = LABEL_TO_CODE[norm(a.textContent)];
      if(code) byCode[code] = a;
    }
    return byCode;
  }

  // Pinta usando únicamente rubro_state_* presentes en el DOM
  function paintFromStates(formRoot, nb, byCode, last){
    let changed = false;
    for(const [code, link] of Object.entries(byCode)){
      const st = readIntField(formRoot, STATE_FIELD(code));
      const sNorm = (st === 1 || st === 2) ? st : 0; // desconocido/otros -> rojo
      if (last[code] !== sNorm){
        applyTab(link, sNorm);
        last[code] = sNorm;
        changed = true;
      }
    }
    return changed;
  }

  // Observa cambios para re-pintar cuando se actualicen los rubro_state_*
  function watchStates(formRoot, nb, byCode, last){
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      // pequeños reintentos para cubrir latencia de re-render
      setTimeout(() => { scheduled = false; try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 0);
      setTimeout(() => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 30);
      setTimeout(() => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 120);
      setTimeout(() => { try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){} }, 360);
    };

    const mo = new MutationObserver((muts) => {
      try{
        for(const mut of muts){
          const t = mut.target;
          if (!(t instanceof Element)) continue;
          const name = t.getAttribute?.("name") || t.getAttribute?.("data-name") || "";
          if (name.startsWith("rubro_state_")){ schedule(); return; }
          const holder = t.closest?.('[name^="rubro_state_"], [data-name^="rubro_state_"]');
          if (holder){ schedule(); return; }
        }
      }catch(_e){}
    });

    mo.observe(formRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-value", "value", "class"],
    });

    // Utilidades de depuración opcional en consola
    window.__ccnTabsWatch = {
      dump(){ console.log(JSON.parse(JSON.stringify(last))); },
      repaint(){ paintFromStates(formRoot, nb, byCode, last); }
    };
  }

  // Espera a que esté la vista form + notebook
  function waitFormAndNotebook(cb){
    const tryStart = () =>{
      const formRoot = document.querySelector('.o_form_view');
      const nb = getNotebook();
      if(formRoot && nb) return cb(formRoot, nb);
    };
    if (tryStart()) return;
    const obs = new MutationObserver(()=>{
      if (tryStart()){ obs.disconnect(); }
    });
    obs.observe(document.documentElement, {childList:true,subtree:true});
  }

  // Boot
  try{
    waitFormAndNotebook((formRoot, nb)=>{
      const byCode = indexByCode(nb);
      if (!Object.keys(byCode).length) return; // no tabs mapeadas
      const last = {};
      // Pintado inicial
      try{ paintFromStates(formRoot, nb, byCode, last); }catch(_e){}
      // Observa y repinta ante cambios en rubro_state_*
      watchStates(formRoot, nb, byCode, last);
    });
  }catch(_e){}
})();
