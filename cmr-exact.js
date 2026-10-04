'use strict';
/* ORIGINAL XLSX TEMPLATE: preserves styles, merged ranges, embedded company stamp,
   drawings, print settings and all four distinct copy tabs. Only cell XML values change. */
const EXACT_DB='expedidocs-native-template', EXACT_STORE='assets';
function templateDatabase(){return new Promise((resolve,reject)=>{const q=indexedDB.open(EXACT_DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(EXACT_STORE);q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result)})}
async function storeTemplate(bytes){const d=await templateDatabase();await new Promise((resolve,reject)=>{const tx=d.transaction(EXACT_STORE,'readwrite');tx.objectStore(EXACT_STORE).put(bytes,'cmr');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});d.close()}
async function getTemplate(){const d=await templateDatabase();const r=await new Promise((resolve,reject)=>{const tx=d.transaction(EXACT_STORE);const q=tx.objectStore(EXACT_STORE).get('cmr');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});d.close();return r}
const control=document.createElement('div');control.className='panel';control.innerHTML='<h2>Plantilla CMR Excel original</h2><p class="muted">El CMR exacto se genera modificando solamente los datos de la plantilla Excel, conservando sus cuatro hojas, celdas, bordes, sello, colores y configuración de impresión. Selecciona una sola vez la plantilla original; queda guardada en este navegador y nunca se sube al repositorio público.</p><label class="btn secondary" style="cursor:pointer;display:inline-block">Seleccionar plantilla CMR original (.xlsx)<input id="cmrTemplateInput" type="file" accept=".xlsx" hidden></label> <span id="cmrTemplateStatus">Comprobando plantilla...</span>';
document.querySelector('#datos').prepend(control);
getTemplate().then(x=>document.querySelector('#cmrTemplateStatus').textContent=x?'✓ Plantilla original guardada':'La plantilla se descargará automáticamente cuando esté integrada').catch(()=>document.querySelector('#cmrTemplateStatus').textContent='El almacenamiento local de plantilla no está disponible');
document.querySelector('#cmrTemplateInput').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>10000000)throw Error('Archivo demasiado grande');if(!window.JSZip)throw Error('No se ha cargado el lector XLSX');const bytes=await f.arrayBuffer();const zip=await JSZip.loadAsync(bytes);for(let i=1;i<=4;i++)if(!zip.file('xl/worksheets/sheet'+i+'.xml'))throw Error('La plantilla debe contener cuatro hojas originales');await storeTemplate(bytes);document.querySelector('#cmrTemplateStatus').textContent='✓ Plantilla original guardada';msg('CMR original listo para generar')}catch(err){msg(err.message||'No se pudo guardar la plantilla')}finally{e.target.value=''}});
const XML_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function replaceCell(doc,reference,value){
 let cell=[...doc.getElementsByTagNameNS(XML_NS,'c')].find(el=>el.getAttribute('r')===reference);if(!cell)return;
 // Replace only its value/formula; retain original cell style (s), merge geometry and all other XML.
 for(const ch of [...cell.children])if(['v','is','f'].includes(ch.localName))cell.removeChild(ch);
 cell.setAttribute('t','inlineStr');const i=doc.createElementNS(XML_NS,'is'),t=doc.createElementNS(XML_NS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');i.append(t);cell.append(i);
}
async function exactCMR(shipment){
 let bytes=await getTemplate();if(!bytes){try{const res=await fetch('./cmr_exact_template.xlsx',{cache:'no-store'});if(res.ok){bytes=await res.arrayBuffer();await storeTemplate(bytes)}}catch(e){console.warn('Plantilla integrada no disponible',e)}}if(!bytes){switchTab('datos');msg('Selecciona una vez el archivo cmr_exact_template.xlsx en Datos y copias');return}
 if(!window.JSZip){msg('No se ha podido cargar el generador XLSX');return}
 const zip=await JSZip.loadAsync(bytes);const dt=shipment.date?new Date(shipment.date+'T12:00:00').toLocaleDateString('es-ES'):'';
 for(let i=1;i<=4;i++){
  const path='xl/worksheets/sheet'+i+'.xml',doc=new DOMParser().parseFromString(await zip.file(path).async('string'),'application/xml');
  // The XLSM input panel was M:R, outside the printable A:I region. Map the
  // original printable cells only; never move the right-hand input panel into the CMR.
  const map={
   A9:[shipment.consignee||shipment.destination,shipment.address||''].filter(Boolean).join(' — '),
   C13:shipment.origin||'ZARAGOZA',C14:dt,A15:(shipment.origin||'ZARAGOZA').toUpperCase(),
   F11:[shipment.carrier||'OPERADOR LOGÍSTICO MONJE, S.L.U.',shipment.carrierTax||'B50655216'].join(' · CIF '),
   D21:shipment.pallets??'',B27:shipment.pallets??'',
   B28:shipment.weight??'',B29:shipment.seal??'',
   H21:shipment.tractor||'',I21:shipment.trailer||'',I22:shipment.driver||'',I23:shipment.driverId||'',I24:shipment.phone||'',
   C32:shipment.tractor||'',C33:shipment.trailer||'',
   H27:shipment.mocaco||'',H29:shipment.mocaco2||'',
   G38:dt,E35:shipment.notes||'',
   A47:'',C52:dt
  };
  for(const [ref,val] of Object.entries(map))replaceCell(doc,ref,val);
  zip.file(path,new XMLSerializer().serializeToString(doc));
 }
 const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
 download(out,'CMR-ORIGINAL-'+String(shipment.ref||'expedicion').replace(/[^a-z0-9_-]/gi,'_')+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 msg('CMR original generado con sus cuatro ejemplares');
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action="excel"]');if(!b)return;e.stopImmediatePropagation();const s=db.shipments.find(x=>x.id===b.dataset.id);if(s)try{await exactCMR(s)}catch(err){msg('Error al generar la plantilla: '+err.message)}},true);
