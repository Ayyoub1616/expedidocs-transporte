'use strict';
/* ORIGINAL XLSX TEMPLATE: preserves styles, merged ranges, embedded company stamp,
   drawings, print settings and all four distinct copy tabs. Only cell XML values change. */
const EXACT_DB='expedidocs-native-template', EXACT_STORE='assets';
function templateDatabase(){return new Promise((resolve,reject)=>{const q=indexedDB.open(EXACT_DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(EXACT_STORE);q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result)})}
async function storeTemplate(bytes){const d=await templateDatabase();await new Promise((resolve,reject)=>{const tx=d.transaction(EXACT_STORE,'readwrite');tx.objectStore(EXACT_STORE).put(bytes,'cmr');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});d.close()}
let builtInTemplatePromise=null;
async function getTemplate(){
 if(!builtInTemplatePromise){
  builtInTemplatePromise=(async()=>{
   const response=await fetch('./cmr_exact_template.b64?v=20261004',{cache:'force-cache'});
   if(!response.ok)throw Error('La plantilla Excel original no está disponible ('+response.status+')');
   const encoded=(await response.text()).replace(/\s+/g,'');
   if(!encoded.startsWith('UEsDB')||encoded.length!==145236)throw Error('Integridad de plantilla original no válida');
   const decoded=atob(encoded),bytes=new Uint8Array(decoded.length);
   for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
   // The built-in template is the exact unchanged XLSX from the user, not an approximation.
   return bytes.buffer;
  })().catch(error=>{builtInTemplatePromise=null;throw error});
 }
 return builtInTemplatePromise;
}
const control=document.createElement('div');control.className='note';control.innerHTML='<strong>CMR Excel original integrado.</strong> No necesitas importar plantillas. El botón «CMR Excel exacto» descarga directamente el archivo original rellenado.';
document.querySelector('#datos').prepend(control);
getTemplate().then(()=>msg('Plantilla Excel original preparada')).catch(e=>console.warn('No se pudo precargar la plantilla:',e));
const XML_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function replaceCell(doc,reference,value){
 let cell=[...doc.getElementsByTagNameNS(XML_NS,'c')].find(el=>el.getAttribute('r')===reference);if(!cell)return;
 // Replace only its value/formula; retain original cell style (s), merge geometry and all other XML.
 for(const ch of [...cell.children])if(['v','is','f'].includes(ch.localName))cell.removeChild(ch);
 cell.setAttribute('t','inlineStr');const i=doc.createElementNS(XML_NS,'is'),t=doc.createElementNS(XML_NS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');i.append(t);cell.append(i);
}
async function exactCMR(shipment){
 const bytes=await getTemplate();
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
