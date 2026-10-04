'use strict';
/* Explicit refresh and light automatic polling. Complete queued writes before reading. */
let syncBusy=false;
async function syncExpediDocs(showFeedback=true){
 if(syncBusy||!activeUser||!cloud)return;
 syncBusy=true;const btn=document.querySelector('#syncNow');btn.disabled=true;
 try{
  await writeQueue.catch(()=>{});
  cloudStatus('↻ Sincronizando...');
  const {data,error}=await cloud.from('expedidocs_data').select('payload,updated_at').eq('user_id',activeUser.id).maybeSingle();
  if(error)throw error;
  if(data?.payload){
   const p=data.payload;
   if(Array.isArray(p.shipments)&&Array.isArray(p.destinations)&&Array.isArray(p.drivers)){
    db={version:1,shipments:p.shipments,destinations:p.destinations,drivers:p.drivers,
      carriers:Array.isArray(p.carriers)?p.carriers:[],tractors:Array.isArray(p.tractors)?p.tractors:[],
      trailers:Array.isArray(p.trailers)?p.trailers:[]};
    renderHome();renderCatalogs();renderHistory();
  }}
  cloudStatus('✓ Sincronizado '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}));
  if(showFeedback)msg('Datos actualizados desde la nube');
 }catch(e){cloudStatus('Error de sincronización');if(showFeedback)msg('No se pudo sincronizar. Comprueba la conexión.')}
 finally{syncBusy=false;btn.disabled=false}
}
document.querySelector('#syncNow').addEventListener('click',()=>syncExpediDocs(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeUser)syncExpediDocs(false)});
setInterval(()=>{if(!document.hidden&&activeUser)syncExpediDocs(false)},90000);
