/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart, xml } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";

function readAttrInt(root, name){
  const el = root.querySelector(`[name="${name}"]`) || root.querySelector(`[data-name="${name}"]`);
  if (!el) return null;
  const raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
  const v = parseInt(String(raw).trim(), 10);
  return Number.isFinite(v) ? v : null;
}
function readAttrStr(root, name){
  const el = root.querySelector(`[name="${name}"]`) || root.querySelector(`[data-name="${name}"]`);
  if (!el) return null;
  const raw = el.getAttribute("data-value") || el.getAttribute("value") || el.textContent || "";
  const v = String(raw).trim();
  return v || null;
}
function pageCodeFor(el){
  const page = el.closest('[id^="page_"]');
  if (!page) return null;
  const id = page.getAttribute('id') || '';
  const m = id.match(/^page_(.+)$/);
  if (!m) return null;
  let code = m[1];
  if (code === 'herr_menor_jardineria') code = 'herramienta_menor_jardineria';
  return code;
}

class CCNCatalogDialog extends Component {
  static components = { Dialog };
  static template = xml`
    <Dialog title="'Agregar: Productos'" size="'lg'">
      <t t-slot="body">
        <div class="o_ccn_catalog_dialog">
          <div class="o_ccn_catalog_header">
            <div class="o_ccn_catalog_tools">
              <input t-model="state.search" t-on-input="onSearch" placeholder="Buscar..."/>
              <button t-on-click="toggleView" class="btn btn-secondary">
                <t t-if="state.view === 'kanban'">Lista</t>
                <t t-else="">Imágenes</t>
              </button>
            </div>
          </div>
          <div class="o_ccn_catalog_body">
            <t t-if="state.loading"><span>Cargando...</span></t>
            <t t-else="">
              <div t-if="state.view === 'kanban'" class="o_ccn_catalog_grid">
                <t t-foreach="state.items" t-as="it" t-key="it.id">
                  <div class="o_ccn_card">
                    <img t-if="it.image_128" t-att-src="'data:image/png;base64,' + it.image_128"/>
                    <div class="o_ccn_card_body">
                      <strong t-esc="it.name"/>
                      <div t-if="it.default_code">[<t t-esc="it.default_code"/>]</div>
                      <div t-if="it.list_price !== undefined &amp;&amp; it.list_price !== null">$ <t t-esc="it.list_price"/></div>
                    </div>
                    <div class="o_ccn_card_footer">
                      <input type="number" min="1" step="1" class="o_ccn_qty_input"
                             t-att-data-id="it.id"
                             t-att-value="getQty(it.id)"
                             t-on-click="stopBubble"
                             t-on-input="onQtyInput"/>
                      <button class="btn btn-primary btn-sm"
                              t-att-data-id="it.id"
                              t-on-click="onAddOne">Agregar</button>
                    </div>
                  </div>
                </t>
              </div>
              <table t-if="state.view !== 'kanban'" class="table table-sm">
                <thead><tr><th>Nombre</th><th>Código</th><th>Precio</th><th style="width:9rem">Cantidad</th><th style="width:8rem"></th></tr></thead>
                <tbody>
                  <t t-foreach="state.items" t-as="it" t-key="it.id">
                    <tr>
                      <td><t t-esc="it.name"/></td>
                      <td><t t-esc="it.default_code || ''"/></td>
                      <td><t t-esc="(it.list_price ?? '')"/></td>
                      <td>
                        <input type="number" min="1" step="1" class="o_ccn_qty_input"
                               t-att-data-id="it.id"
                               t-att-value="getQty(it.id)"
                               t-on-input="onQtyInput"/>
                      </td>
                      <td>
                        <button class="btn btn-primary btn-sm"
                                t-att-data-id="it.id"
                                t-on-click="onAddOne">Agregar</button>
                      </td>
                    </tr>
                  </t>
                </tbody>
              </table>
            </t>
          </div>
        </div>
      </t>
      <t t-slot="footer">
        <button class="btn btn-secondary" t-on-click="onClose">Cerrar</button>
      </t>
    </Dialog>
  `;

  setup(){
    this.orm = useService('orm');
    this.action = useService('action');
    this.notification = useService('notification');
    this.state = useState({ items: [], qty: {}, search: '', view: 'kanban', loading: true });
    onWillStart(async () => { await this.load(); });
  }

  isSelected(){ return false; }
  toggleSel(){ /* no-op */ }
  toggleView(){ this.state.view = this.state.view === 'kanban' ? 'list' : 'kanban'; }
  onSearch(){ this.load(); }
  onClose(){ this.env.services.dialog.close(); }
  onToggle(){ /* no-op */ }

  stopBubble(ev){ try{ ev.stopPropagation(); }catch(_e){} }
  onCheckboxToggle(){ /* no-op */ }
  getQty(id){
    const raw = (this.state.qty && this.state.qty[id] != null) ? this.state.qty[id] : 1;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  onQtyInput(ev){
    try{
      const id = parseInt(ev.currentTarget?.dataset?.id || '0', 10);
      if (!id) return;
      const v = parseInt(String(ev.currentTarget.value || '1'), 10);
      const n = Number.isFinite(v) && v > 0 ? v : 1;
      const q = Object.assign({}, this.state.qty || {});
      q[id] = n;
      this.state.qty = q;
    }catch(_e){}
  }
  canAddMany(){
    try{
      const q = this.state.qty || {};
      let cnt = 0;
      for (const k of Object.keys(q)){
        const n = parseInt(String(q[k]||0),10);
        if (Number.isFinite(n) && n > 0) cnt++;
        if (cnt >= 2) return true;
      }
      return false;
    }catch(_e){ return false; }
  }
  async onAddMany(){
    const q = this.state.qty || {};
    const ids = Object.keys(q).map((k)=> parseInt(k,10)).filter((id)=> id && (parseInt(String(q[id]||0),10) > 0));
    if (!ids.length) return;
    const rubros = await this.orm.searchRead('ccn.service.rubro', [['code', '=', this.props.rubro]], ['id']);
    const rubroId = (rubros && rubros[0] && rubros[0].id) || false;
    const type = this.props.serviceType === 'materiales' ? 'material' : 'servicio';
    const values = ids.map((pid)=>({
      quote_id: this.props.quoteId,
      site_id: this.props.siteId || false,
      service_type: this.props.serviceType || false,
      type,
      rubro_id: rubroId,
      product_id: pid,
      quantity: this.getQty(pid),
    }));
    try{ await this.orm.create('ccn.service.quote.line', values); }
    catch(e){ throw e; }
    await this.action.doAction({ type: 'ir.actions.client', tag: 'reload' });
  }

  async load(){
    this.state.loading = true;
    const domain = [...(this.props.domain || [])];
    if (this.state.search && this.state.search.trim()){
      domain.push(['name', 'ilike', this.state.search.trim()]);
    }
    const fields = ['name','default_code','list_price','image_128','product_tmpl_id'];
    const items = await this.orm.searchRead('product.product', domain, fields, { limit: 80 });
    const list = items || [];
    // Fallback: si la variante no tiene imagen, usa la del template
    const missing = list.filter((it) => !it.image_128 && it.product_tmpl_id && it.product_tmpl_id[0]);
    if (missing.length){
      const tmplIds = [...new Set(missing.map((it)=> it.product_tmpl_id[0]))];
      const tpls = await this.orm.searchRead('product.template', [['id','in', tmplIds]], ['image_128']);
      const mapImg = Object.fromEntries((tpls||[]).map(t=>[t.id, t.image_128]));
      missing.forEach((it)=>{ const im = mapImg[it.product_tmpl_id[0]]; if (im) it.image_128 = im; });
    }
    this.state.items = list;
    this.state.loading = false;
  }

  async onAdd(){ /* no-op: bulk add deshabilitado */ }

  async onAddOne(ev){
    try{ ev.stopPropagation(); }catch(_e){}
    const id = parseInt(ev.currentTarget?.dataset?.id || '0', 10);
    if (!id) return;
    const rubros = await this.orm.searchRead('ccn.service.rubro', [['code', '=', this.props.rubro]], ['id']);
    const rubroId = (rubros && rubros[0] && rubros[0].id) || false;
    const type = this.props.serviceType === 'materiales' ? 'material' : 'servicio';
    const qty = this.getQty(id);
    const vals = {
      quote_id: this.props.quoteId,
      site_id: this.props.siteId || false,
      service_type: this.props.serviceType || false,
      type,
      rubro_id: rubroId,
      product_id: id,
      quantity: qty,
    };
    try{ await this.orm.create('ccn.service.quote.line', [vals]); }
    catch(e){ throw e; }
    await this.action.doAction({ type: 'ir.actions.client', tag: 'reload' });
  }
}

// Client Action: abre el selector directo con contexto del botón (rubro/quote/site/service_type)
registry.category("actions").add("ccn_catalog_direct_select", async (env, action) => {
  const { dialog, notification } = env.services;
  const ctx = (action && action.context) || {};
  const quoteId = ctx.quote_id || ctx.active_id;
  let siteId = ctx.site_id || null;
  const serviceType = ctx.service_type || null;
  const rubro = ctx.rubro_code || null;
  if (!quoteId || !rubro){
    notification?.add('No se pudo abrir Catálogo (falta contexto).', { type: 'warning' });
    return;
  }
  const domain = [
    ['product_tmpl_id.ccn_exclude_from_quote', '=', false],
    ['product_tmpl_id.sale_ok', '=', true],
    ['product_tmpl_id.ccn_rubro_ids.code', '=', rubro],
  ];
  // sin notificaciones ni delays
  // Si no viene siteId en el contexto, resolver al 'General' del quote
  try {
    if (!siteId && quoteId) {
      const sid = await env.services.orm.call('ccn.service.quote.site', 'get_or_create_general', [quoteId]);
      if (sid) siteId = sid;
    }
  } catch(_e) {}
  dialog.add(CCNCatalogDialog, { domain, quoteId, siteId, serviceType, rubro });
});
