'use strict';
/* The backgrounds of the four pages are exports of the actual original Excel CMR.
   Only its blank input positions are filled: borders, colors, images and stamp
   originate from the workbook, not from an HTML imitation. */
let pdfTemplatePromise=null;
async function cmrPdfBase(){
 if(!pdfTemplatePromise)pdfTemplatePromise=(async()=>{
  const r=await fetch('./cmr_pdf_background.b64?v=20261004',{cache:'force-cache'});
  if(!r.ok)throw Error('No se ha podido descargar el fondo PDF original');
  const b64=(await r.text()).replace(/\s+/g,'');
  if(!b64.startsWith('JVBER')||b64.length!==310740)throw Error('Plantilla PDF incompleta');
  const decoded=atob(b64),bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  return bytes;
 })().catch(e=>{pdfTemplatePromise=null;throw e});
 return pdfTemplatePromise;
}
function pdfValue(value){return String(value??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/[^\u0020-\u00ff]/g,' ').trim()}
async function exactCMRPdf(d){
 if(!window.PDFLib)throw Error('El componente PDF no se ha podido cargar');
 const pdf=await PDFLib.PDFDocument.load(await cmrPdfBase());
 const fonts={
  serif:await pdf.embedFont(PDFLib.StandardFonts.TimesRomanBold),
  sans:await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold),
  regular:await pdf.embedFont(PDFLib.StandardFonts.TimesRoman)
 };
 const widthLimit=(font,value,size,maxW)=>{while(size>4.8&&font.widthOfTextAtSize(value,size)>maxW)size-=0.2;return size};
 const wrapText=(font,text,size,width,maxLines=2)=>{
  const words=pdfValue(text).split(/\s+/).filter(Boolean),lines=[];
  let line='';
  for(const word of words){
   const test=line?line+' '+word:word;
   if(line&&font.widthOfTextAtSize(test,size)>width){lines.push(line);line=word;if(lines.length>=maxLines-1)break;}
   else line=test;
  }
  if(line)lines.push(line);
  const consumed=lines.join(' ').split(/\s+/).length;
  if(consumed<words.length&&lines.length){let last=lines.length-1;lines[last]=words.slice(consumed-lines[last].split(/\s+/).length).join(' ');}
  return lines.slice(0,maxLines);
 };
 // Reference positions (x, baseline from top) were measured on the PDF exported
 // from this exact workbook using harmless placeholder values in each input cell.
 function place(pg,x,top,value,font,size,maxW,center=false,lines=1){
  const txt=pdfValue(value);
  if(!txt)return;
  const ff=fonts[font]||fonts.serif;
  const chunks=lines>1?wrapText(ff,txt,size,maxW,lines):[txt];
  chunks.forEach((raw,i)=>{
   const str=pdfValue(raw);
   const actual=widthLimit(ff,str,size,maxW);
   const xpos=center?x-ff.widthOfTextAtSize(str,actual)/2:x;
   pg.drawText(str,{x:xpos,y:pg.getHeight()-top-i*(actual+1.3),size:actual,font:ff,color:PDFLib.rgb(0,0,0),maxWidth:maxW});
  });
 }
 const date=d.date?new Date(d.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):'';
 const stampDate=d.date?new Date(d.date+'T12:00:00').toLocaleDateString('es-ES')+' '+(d.time||new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})):'';
 const weight=d.weight===''||d.weight==null?'':Number(d.weight).toLocaleString('es-ES',{maximumFractionDigits:2});
 for(const page of pdf.getPages()){
  place(page,171.2,193,[d.consignee||d.destination,...((d.consignee||'').includes(d.address||'###')?[]:[d.address||''])].filter(Boolean).join(' '),'serif',9.2,186,true,2);
  place(page,215.5,255.1,d.destination||'','serif',8.6,88,true);
  place(page,176.1,276.3,date,'sans',6.6,100);
  place(page,163.4,296,d.origin||'ZARAGOZA','sans',9.2,150);
  place(page,396.2,207.6,[/monje/i.test(d.carrier||'')?'MONJE':d.carrier||'MONJE','CIF '+(d.carrierTax||'B50655216')].join(' · '),'serif',7.9,215,true);
  place(page,233.2,417.1,d.pallets??'','sans',11.9,50,true);
  place(page,194.5,520.6,d.pallets??'','sans',11.9,60,true);
  place(page,178.3,538.4,weight,'sans',11.9,78,true);
  place(page,194.5,553.8,d.seal??'','sans',11.9,85,true);
  place(page,383.2,418.8,d.tractor??'','serif',10.6,72,true);
  place(page,474,418.8,d.trailer??'','serif',10.6,78,true);
  place(page,474,433.1,d.driver??'','serif',6.6,88,true);
  place(page,474,454.8,d.driverId??'','serif',9.2,82,true);
  place(page,474,470.7,d.phone??'','serif',9.2,82,true);
  place(page,222.7,595.4,d.tractor??'','sans',9.2,112,true);
  place(page,222.7,607.8,d.trailer??'','sans',9.2,112,true);
  place(page,431.6,528.2,d.mocaco??'','serif',13.2,145,true);
  place(page,431.6,560.1,d.mocaco2??'','serif',13.2,145,true);
  place(page,413,653.4,d.unloadDate?new Date(d.unloadDate+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):date,'serif',9.2,110,true);
  place(page,250,634.1,d.notes??'','regular',6.6,220,false,2);
  place(page,222.6,775.5,stampDate,'serif',9.2,94,true);
  // Point 16 is deliberately empty. It is never drawn into the PDF.
 }
 // Expand the original background and filled values together onto A4.
 // Remove only the surrounding white space; preserve every original CMR element.
 await pdf.flush();
 const expanded=await PDFLib.PDFDocument.create();
 const margin=20;
 for(const original of pdf.getPages()){
  const embedded=await expanded.embedPage(original,{
   left:70,right:525,bottom:original.getHeight()-814,top:original.getHeight()-28
  });
  const page=expanded.addPage(PDFLib.PageSizes.A4);
  page.drawPage(embedded,{x:margin,y:margin,width:page.getWidth()-margin*2,height:page.getHeight()-margin*2});
 }
 const bytes=await expanded.save({useObjectStreams:true});
 download(new Blob([bytes],{type:'application/pdf'}),'CMR-A4-ANCHO-'+String(d.ref||'expedicion').replace(/[^a-z0-9_-]/gi,'_')+'.pdf','application/pdf');
 msg('CMR PDF A4 ancho generado · 4 copias · márgenes de 7 mm');
}
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action="pdf"]');if(!btn)return;
 e.stopImmediatePropagation();
 const s=db.shipments.find(x=>x.id===btn.dataset.id);
 if(!s)return;
 btn.disabled=true;
 try{await exactCMRPdf(s)}catch(error){msg('No se pudo crear el PDF: '+error.message)}
 finally{btn.disabled=false}
},true);
cmrPdfBase().catch(error=>console.warn('No se pudo precargar el PDF CMR:',error));
