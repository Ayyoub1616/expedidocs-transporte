'use strict';
/* Compact private dispatch form. Personal information stays in authenticated Supabase storage. */
const PLATES_T=['2073 HZN','9187 FWW','9161 KSB','1959 LJS','5090 JZJ','5577 JGN'];
const PLATES_R=['R9669BCN','L171565','R9075BCN','R0828BCZ','VI7956','R8090BCR'];
const DESTINATIONS=[
['BLECKMANN','CALLE ALAUN 9 50197 ZARAGOZA'],
['JEVASO','CALLE TURIASO 8 50197 ZARAGOZA'],
['JEVASO 4','C/ TAORMINA 1 50197 ZARAGOZA'],
['CTR','AV. DEL ROSARIO 4 CUARTE'],
['LACOR PLAZA','CALLE BARI 285 50197 ZARAGOZA'],
['NAVE PLANCHA MALPICA','POL. MALPICA CALLE E S/N ZARAGOZA'],
['NAVE DEVOLUCIONES','CALLE TURIASO 38 50197 ZARAGOZA'],
['PLANCHADOS SABELA','CALLE JUPITER VILLANUEVA DE GALLEGO'],
['PLATAFORMA EUROPA INDITEX','C/ TURIASO 115, POLÍGONO PLAZA, 50197 ZARAGOZA']
];
const normalizePlate=v=>String(v||'').trim().toUpperCase().replace(/\s+/g,' ');
const uniquePlates=(arr)=>Array.from(new Set(arr.map(normalizePlate).filter(Boolean)));
const dateText=v=>v?new Date(v+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):'';
const qHtml='<div class="quick-hint"><strong>Solo lo necesario.</strong> Cargador, origen, datos legales y texto del CMR se completan automáticamente. Conductor, tractora y remolque son tres listas independientes.</div>'+
'<form id="quickForm"><input type="hidden" name="editId" id="qEdit"><div class="quick-fields">'+
'<label class="field">FECHA *<input name="date" type="date" required></label>'+
'<label class="field wide">DESTINO *<select id="qDest" required></select></label>'+
'<label class="field">TRACTORA *<select id="qTractor" required></select></label>'+
'<label class="field">REMOLQUE *<select id="qTrailer" required></select></label>'+
'<label class="field">Nº PALETS *<input name="pallets" type="number" min="0" max="999999" value="0" required></label>'+
'<label class="field">PRECINTO<input name="seal" maxlength="60"></label>'+ 
'<label class="field">PESO CARGA (kg)<input name="weight" type="number" min="0" max="1000000" step="0.01" placeholder="Ej. 9000"></label>'+
'<label class="field wide">CONDUCTOR *<select id="qDriver" required></select></label>'+
'<label class="field">NOMBRE<input id="qDriverName" class="quick-readonly" readonly></label>'+
'<label class="field">NIF / NIE<input id="qDni" class="quick-readonly" readonly></label>'+
'<label class="field">TELÉFONO<input id="qPhone" class="quick-readonly" readonly></label>'+
'<label class="field">MOCACO<input name="mocaco" maxlength="120" placeholder="Ej. 6318/342/800"></label>'+
'<label class="field">MOCACO 2<input name="mocaco2" maxlength="120" placeholder="Ej. 5121 uds."></label>'+
'<label class="field wide">OBSERVACIONES<textarea name="notes" maxlength="1500"></textarea></label></div>'+
'<div class="actions"><button class="btn" type="submit">Guardar expedición</button><button class="btn secondary" id="quickClear" type="button">Nueva / limpiar</button></div></form>';
document.querySelector('#quickFormMount').innerHTML=qHtml;
const qForm=document.querySelector('#quickForm');
const opt=(val,label)=>'<option value="'+esc(val)+'">'+esc(label)+'</option>';
function seedDefaults(){
 let changed=false;
 if(!db.destinations.length){db.destinations=DESTINATIONS.map((x,i)=>({id:'dest-'+(i+1),code:'D-'+(i+1),name:x[0],address:x[1]}));changed=true;}
 if(!db.tractors?.length){db.tractors=PLATES_T;changed=true;}
 if(!db.trailers?.length){db.trailers=PLATES_R;changed=true;}
 // Migrate old combined profiles to three INDEPENDENT catalogs, without changing any original driver identity.
 const t=uniquePlates([...(db.tractors||[]),...db.drivers.map(d=>d.tractor)]);
 const r=uniquePlates([...(db.trailers||[]),...db.drivers.map(d=>d.trailer)]);
 if(t.length!==(db.tractors||[]).length ||r.length!==(db.trailers||[]).length){db.tractors=t;db.trailers=r;changed=true;}
 if(changed&&activeUser)save();
}
function renderQuick(){
 const old={dest:document.querySelector('#qDest').value,tractor:document.querySelector('#qTractor').value,trailer:document.querySelector('#qTrailer').value,driver:document.querySelector('#qDriver').value};
 const dest=document.querySelector('#qDest'),tr=document.querySelector('#qTractor'),tl=document.querySelector('#qTrailer'),dr=document.querySelector('#qDriver');
 dest.innerHTML=opt('','Seleccionar destino...')+db.destinations.map(d=>opt(d.id,d.name+' — '+d.address)).join('');
 tr.innerHTML=opt('','Seleccionar tractora...')+uniquePlates(db.tractors||[]).map(x=>opt(x,x)).join('');
 tl.innerHTML=opt('','Seleccionar remolque...')+uniquePlates(db.trailers||[]).map(x=>opt(x,x)).join('');
 dr.innerHTML=opt('','Seleccionar conductor...')+db.drivers.map(d=>opt(d.id,d.name)).join('');
 if([...dest.options].some(x=>x.value===old.dest))dest.value=old.dest;
 if([...tr.options].some(x=>x.value===old.tractor))tr.value=old.tractor;
 if([...tl.options].some(x=>x.value===old.trailer))tl.value=old.trailer;
 if([...dr.options].some(x=>x.value===old.driver))dr.value=old.driver;
 populateDriver();
 const table=(arr,name)=>arr.length?'<table><tbody>'+arr.map(v=>'<tr><td>'+esc(v)+'</td><td><button type="button" class="btn warn" data-plate-cat="'+name+'" data-plate="'+esc(v)+'">×</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">Sin datos</p>';
 document.querySelector('#tractorList').innerHTML=table(db.tractors||[],'tractors');
 document.querySelector('#trailerList').innerHTML=table(db.trailers||[],'trailers');
 document.querySelector('#driverList').innerHTML=db.drivers.length?'<table><tbody>'+db.drivers.map(d=>'<tr><td>'+esc(d.name)+'</td><td>'+esc(d.driverId||'')+'</td><td>'+esc(d.phone||'')+'</td><td><button class="btn warn" data-cat="drivers" data-id="'+esc(d.id)+'">×</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">Sin conductores</p>';
}
function populateDriver(){const d=db.drivers.find(x=>x.id===document.querySelector('#qDriver').value);document.querySelector('#qDriverName').value=d?.name||'';document.querySelector('#qDni').value=d?.driverId||'';document.querySelector('#qPhone').value=d?.phone||'';}
document.querySelector('#qDriver').addEventListener('change',populateDriver);
const qClear=()=>{qForm.reset();qForm.elements.date.value=today();document.querySelector('#qEdit').value='';document.querySelector('#formTitle').textContent='Nueva expedición';populateDriver();};
document.querySelector('#quickClear').addEventListener('click',qClear);
qClear();
for(const cat of ['tractor','trailer']){
 const form=document.querySelector('#'+cat+'Form');
 form.addEventListener('submit',e=>{e.preventDefault();const key=cat==='tractor'?'tractors':'trailers',plate=normalizePlate(form.elements.plate.value);if(!plate||db[key].includes(plate))return msg('Matrícula vacía o repetida');db[key].push(plate);save();form.reset();renderQuick();msg('Matrícula añadida')});
}
document.querySelector('#catalogos').addEventListener('click',e=>{let btn=e.target.closest('[data-plate-cat]');if(!btn)return;let k=btn.dataset.plateCat,v=btn.dataset.plate;if(!confirm('¿Borrar '+v+' del catálogo? No se modificarán los documentos anteriores.'))return;db[k]=db[k].filter(x=>x!==v);save();renderQuick()});
const originalRenderCatalogs=renderCatalogs;
renderCatalogs=function(){originalRenderCatalogs();seedDefaults();renderQuick()};
const originalEdit=edit;
edit=function(id){
 const s=db.shipments.find(x=>x.id===id);if(!s)return;
 qClear();renderQuick();document.querySelector('#qEdit').value=s.id;
 document.querySelector('#formTitle').textContent='Editar · '+s.ref;
 for(const k of ['date','pallets','seal','weight','mocaco','mocaco2','notes'])if(qForm.elements[k])qForm.elements[k].value=s[k]??'';
 const dest=db.destinations.find(x=>x.id===s.destinationId||x.name===s.destination);
 if(dest)document.querySelector('#qDest').value=dest.id;
 document.querySelector('#qTractor').value=s.tractor||'';
 document.querySelector('#qTrailer').value=s.trailer||'';
 const driver=db.drivers.find(x=>x.id===s.driverCatalogId||x.name===s.driver);
 if(driver)document.querySelector('#qDriver').value=driver.id;
 populateDriver();switchTab('nueva');
};
qForm.addEventListener('submit',e=>{
 e.preventDefault();
 if(!activeUser)return msg('Inicia sesión primero');
 const dest=db.destinations.find(x=>x.id===document.querySelector('#qDest').value),driver=db.drivers.find(x=>x.id===document.querySelector('#qDriver').value);
 const tr=document.querySelector('#qTractor').value,tl=document.querySelector('#qTrailer').value;
 if(!dest||!driver||!tr||!tl)return msg('Selecciona destino, conductor, tractora y remolque');
 const old=db.shipments.find(x=>x.id===document.querySelector('#qEdit').value);
 const d={...(old||{}),...FIXED_SENDER,...Object.fromEntries(new FormData(qForm)),date:qForm.elements.date.value,
 destinationId:dest.id,destination:dest.name,address:dest.address,consignee:dest.name,
 tractor:tr,trailer:tl,driverCatalogId:driver.id,driver:driver.name,driverId:driver.driverId||'',phone:driver.phone||'',
 carrier:'OPERADOR LOGÍSTICO MONJE, S.L.U.',carrierTax:'B50655216',origin:'Zaragoza',dispatcher:'',pallets:Number(qForm.elements.pallets.value),
 packages:0,bars:0,packaging:'Palets de madera',goods:'PALETS MADERA ENVIADOS',mode:'Normal',weight:qForm.elements.weight.value===''?'':Number(qForm.elements.weight.value),
 unloadDate:qForm.elements.date.value,model:[qForm.elements.mocaco.value,qForm.elements.mocaco2.value].filter(Boolean).join('\n'),
 id:old?.id||uuid(),ref:old?.ref||('EXP-'+Date.now().toString(36).toUpperCase()),
 created:old?.created||new Date().toISOString(),updated:new Date().toISOString()};
 if(!d.date||!Number.isSafeInteger(d.pallets)||d.pallets<0)return msg('Revisa fecha y palets');
 db.shipments=old?db.shipments.map(x=>x.id===d.id?d:x):[...db.shipments,d];
 if(save()){qClear();renderHome();switchTab('historial');msg('Expedición guardada en la nube')}
});
// Print CMR: keep fields and four versions but ensure the company stamp and duplicate title stay within each page.
const baseDocumentPage=documentPage;
documentPage=function(d,copy,i){
 const enriched={...d,...FIXED_SENDER,model:[d.mocaco,d.mocaco2].filter(Boolean).join('\n')||d.model||''};
 let page=baseDocumentPage(enriched,copy,i);
 page=page.replace('17. Firma y sello del cargador</div>','17. Firma y sello del cargador<div class="cmr-stamp-text">SERVAL RETAIL Y CONSUMO, SL<br>C/ OSCA 10 · POL. PLAZA<br>50197 ZARAGOZA</div></div>');
 return page;
};
