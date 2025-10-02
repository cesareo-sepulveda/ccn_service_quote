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
                  <div class="o_ccn_card" t-att-class="isSelected(it.id) ? 'selected' : ''" t-att-data-id="it.id" t-on-click="onToggle">
                    <img t-if="it.image_128" t-att-src="'data:image/png;base64,' + it.image_128"/>
                    <div class="o_ccn_card_body">
                      <strong t-esc="it.name"/>
                      <div t-if="it.default_code">[<t t-esc="it.default_code"/>]</div>
                      <div t-if="it.list_price !== undefined &amp;&amp; it.list_price !== null">$ <t t-esc="it.list_price"/></div>
                    </div>
                    <input type="checkbox" t-att-checked="isSelected(it.id)"/>
                  </div>
                </t>
              </div>
              <table t-if="state.view !== 'kanban'" class="table table-sm">
                <thead><tr><th></th><th>Nombre</th><th>Código</th><th>Precio</th></tr></thead>
                <tbody>
                  <t t-foreach="state.items" t-as="it" t-key="it.id">
                    <tr>
                      <td><input type="checkbox" t-att-checked="isSelected(it.id)" t-att-data-id="it.id" t-on-change="onToggle"/></td>
                      <td><t t-esc="it.name"/></td>
                      <td><t t-esc="it.default_code || ''"/></td>
                      <td><t t-esc="(it.list_price ?? '')"/></td>
                    </tr>
                  </t>
                </tbody>
              </table>
            </t>
          </div>
        </div>
      </t>
      <t t-slot="footer">
        <button class="btn btn-primary" t-on-click="onAdd">Agregar</button>
        <button class="btn btn-secondary" t-on-click="onClose">Cerrar</button>
      </t>
    </Dialog>
  `;

  setup(){
    this.orm = useService('orm');
    this.action = useService('action');
    this.notification = useService('notification');
    this.state = useState({ items: [], selected: new Set(), search: '', view: 'kanban', loading: true });
    onWillStart(async () => { await this.load(); });
  }

  isSelected(id){ return this.state.selected.has(id); }
  toggleSel(id){
    if (!this || !this.state) return;
    const s = new Set(this.state.selected || []);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.state.selected = s;
  }
  toggleView(){ this.state.view = this.state.view === 'kanban' ? 'list' : 'kanban'; }
  onSearch(){ this.load(); }
  onClose(){ this.env.services.dialog.close(); }
  onToggle(ev){
    try{
      const id = parseInt(ev.currentTarget?.dataset?.id || '0', 10);
      if (!id || !this?.state) return;
      this.toggleSel(id);
    }catch(_e){}
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

  async onAdd(){
    const ids = Array.from(this.state.selected.values());
    if (!ids.length) return;
    const rubros = await this.orm.searchRead('ccn.service.rubro', [['code', '=', this.props.rubro]], ['id']);
    const rubroId = (rubros && rubros[0] && rubros[0].id) || false;
    const type = this.props.serviceType === 'materiales' ? 'material' : 'servicio';
    const values = ids.map((pid) => ({
      quote_id: this.props.quoteId,
      site_id: this.props.siteId || false,
      service_type: this.props.serviceType || false,
      type,
      rubro_id: rubroId,
      product_id: pid,
      quantity: 1.0,
    }));
    try{
      await this.orm.create('ccn.service.quote.line', values);
    }catch(e){
      this.notification.add('No se pudieron agregar productos', { type: 'danger' });
      throw e;
    }
    this.notification.add('Productos agregados', { type: 'success' });
    await this.action.doAction({ type: 'ir.actions.client', tag: 'reload' });
    // Mantener abierto para seguir eligiendo; limpiar selección
    this.state.selected = new Set();
  }
}

// Client Action: abre el selector directo con contexto del botón (rubro/quote/site/service_type)
registry.category("actions").add("ccn_catalog_direct_select", async (env, action) => {
  const { dialog, notification } = env.services;
  const ctx = (action && action.context) || {};
  const quoteId = ctx.quote_id || ctx.active_id;
  const siteId = ctx.site_id || null;
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
  notification?.add('Abriendo Catálogo…', { type: 'info', sticky: false });
  dialog.add(CCNCatalogDialog, { domain, quoteId, siteId, serviceType, rubro });
});
