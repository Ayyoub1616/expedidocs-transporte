'use strict';
/* ORIGINAL XLSX TEMPLATE: preserves styles, merged ranges, embedded company stamp,
   drawings, print settings and all four distinct copy tabs. Only cell XML values change. */
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
function replaceCell(doc,reference,value,numeric=false){
 let cell=[...doc.getElementsByTagNameNS(XML_NS,'c')].find(el=>el.getAttribute('r')===reference);if(!cell)throw Error('Celda original no encontrada: '+reference);
 // Replace only its value/formula; retain original cell style (s), merge geometry and all other XML.
 for(const ch of [...cell.children])if(['v','is','f'].includes(ch.localName))cell.removeChild(ch);
 if(numeric&&!Number.isFinite(Number(value)))throw Error('Valor numérico no válido en '+reference);
 if(numeric){cell.setAttribute('t','n');const v=doc.createElementNS(XML_NS,'v');v.textContent=String(value??0);cell.append(v);return}
 cell.setAttribute('t','inlineStr');const i=doc.createElementNS(XML_NS,'is'),t=doc.createElementNS(XML_NS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');i.append(t);cell.append(i);
}
async function exactCMR(shipment){
 const bytes=await getTemplate();
 if(!window.JSZip)throw Error('No se ha podido cargar el generador XLSX');
 const zip=await JSZip.loadAsync(bytes);const dt=shipment.date?new Date(shipment.date+'T12:00:00').toLocaleDateString('es-ES'):'';
 const numericCells=new Set(['D21','B27','B28','A24','C14','G38','C52']);
 const serial=shipment.date?(Date.parse(shipment.date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000:0;
 const clock=shipment.time||new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
 const [hh,mm]=clock.split(':').map(Number);
 const datetime=serial+((hh||0)*60+(mm||0))/1440;
 for(let i=1;i<=4;i++){
  const path='xl/worksheets/sheet'+i+'.xml';
  if(!zip.file(path))throw Error('Falta el ejemplar original '+i);
  const doc=new DOMParser().parseFromString(await zip.file(path).async('string'),'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('XML original no válido');
  // The XLSM input panel was M:R, outside the printable A:I region. Map the
  // original printable cells only; never move the right-hand input panel into the CMR.
  // Exact editable cells mapped against the original CARGADOR/TRANSPORTISTA/EXPEDIDOR/DESTINATARIO sheets.
  const map={
   A9:[shipment.consignee||shipment.destination,shipment.address||''].filter(Boolean).join('\n'),
   C13:shipment.destination||'',C14:serial||'',A15:shipment.origin||'ZARAGOZA',
   F11:[shipment.carrier||'OPERADOR LOGÍSTICO MONJE, S.L.U.',shipment.carrierTax||'B50655216'].filter(Boolean).join(' · CIF '),
   D21:shipment.pallets??'',I21:shipment.trailer||'',H21:shipment.tractor||'',
   I22:shipment.driver||'',I23:shipment.driverId||'',I24:shipment.phone||'',
   A24:shipment.bars??'',B27:shipment.pallets??'',B28:shipment.weight??'',B29:shipment.seal??'',
   H27:shipment.mocaco??shipment.model?.split('\n')[0]??'',H29:shipment.mocaco2??shipment.model?.split('\n')[1]??'',
   C32:shipment.tractor||'',C33:shipment.trailer||'',
   G38:shipment.unloadDate?(Date.parse(shipment.unloadDate+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000:serial||'',E35:shipment.notes||'',
   C52:serial?datetime:'',
   A47:''
  };
  for(const [ref,val] of Object.entries(map))replaceCell(doc,ref,val,numericCells.has(ref)&&val!==''&&val!=null);
  zip.file(path,new XMLSerializer().serializeToString(doc));
 }
 const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
 download(out,'CMR-ORIGINAL-'+String(shipment.ref||'expedicion').replace(/[^a-z0-9_-]/gi,'_')+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 msg('CMR original generado con sus cuatro ejemplares');
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action="excel"]');if(!b)return;e.stopImmediatePropagation();const s=db.shipments.find(x=>x.id===b.dataset.id);if(!s)return;b.disabled=true;try{await exactCMR(s)}catch(err){msg('Error al generar la plantilla: '+err.message)}finally{b.disabled=false}},true);
