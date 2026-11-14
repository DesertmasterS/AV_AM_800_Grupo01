const {zap}=require('./zap-api.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='http://127.0.0.1:4300';
const runId = Date.now().toString();
const localDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date());
const out=path.join(__dirname,'output',localDate,runId); fs.mkdirSync(out,{recursive:true});
const contextName='SafeAlert-Local-'+runId; const policy='SafeAlert-Web-API-LOW-'+runId;
const summary={startedAt:new Date().toISOString(),target:base,context:contextName,scope:'Solo instancia local con datos sintéticos. Sin GCP, Neon ni WhatsApp.',limitations:['PostgreSQL embebido PGlite con una conexión; no valida configuración o concurrencia de Neon.','Frontend compilado servido por Express para esta prueba; cabeceras de Nginx y TLS de Cloud Run quedan fuera del alcance.','NODE_ENV=development: los atributos de cookies/HSTS observados en HTTP local no representan HTTPS de producción.','La sesión usa un secreto JWT de prueba aleatorio; no se evalúa la configuración secreta real de producción.','ZAP no evalúa sensores, permisos, accesibilidad ni widgets Android.','Escaneo activo acotado: seis familias de reglas, intensidad LOW, máximo dos minutos por exploración.'],checks:[],requests:[],scans:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function send(method,route,body,token){
 const content=body===undefined?'':JSON.stringify(body);
 let request=method+' '+base+route+' HTTP/1.1\r\nHost: 127.0.0.1:4300\r\nConnection: close\r\n';
 if(token) request+='Authorization: Bearer '+token+'\r\nCookie: safealert_session='+token+'\r\n';
 if(body!==undefined) request+='Content-Type: application/json\r\nContent-Length: '+Buffer.byteLength(content)+'\r\n';
 request+='\r\n'+content;
 const json=await zap('core','action','sendRequest',{request,followRedirects:'false'});
 const message=json.sendRequest?.[0]; if(!message) throw new Error('ZAP no devolvió la petición registrada');
 const status=Number(message.responseHeader.split(' ')[1]);
 let data;try{data=JSON.parse(message.responseBody)}catch{data=null}
 summary.requests.push({method,route,status,messageId:message.id});
 return {status,data,message};
}
function check(name,condition,evidence){summary.checks.push({name,result:condition?'PASS':'FAIL',evidence});console.log(JSON.stringify({check:name,result:condition?'PASS':'FAIL'}));}
(async()=>{
 await zap('core','action','newSession',{name:path.join(out,'SafeAlert-verificado.session'),overwrite:'false'});
 const context=await zap('context','action','newContext',{contextName});summary.contextId=context.contextId;
 await zap('context','action','includeInContext',{contextName,regex:'^http://127[.]0[.]0[.]1:4300/.*$'});
 await zap('context','action','setContextInScope',{contextName,booleanInScope:'true'});
 for(const route of ['/home','/login','/register','/profile','/settings','/widget-sos','/emergency-contacts','/history','/companion']) await send('GET',route);
 const login1=await send('POST','/auth/login',{email:'zap.uno@example.invalid',password:'SafeAlert-ZAP-Test-2026!'});
 const login2=await send('POST','/auth/login',{email:'zap.dos@example.invalid',password:'SafeAlert-ZAP-Test-2026!'});
 if(!login1.data?.token||!login2.data?.token) throw new Error('No se autenticaron las cuentas sintéticas');
 const first=login1.data.token,second=login2.data.token;
 check('Autenticación de dos cuentas de prueba',login1.status===200&&login2.status===200,[login1.status,login2.status]);
 const me=await send('GET','/auth/me',undefined,first);check('Sesión autenticada reconocida',me.status===200&&me.data?.usuario?.id===1,me.status);
 for(const route of ['/alerta/historial','/contactos-emergencia']) {const r=await send('GET',route);check('Bloquea acceso anónimo a '+route,r.status===401,r.status);}
 for(const route of ['/alerta/activa','/alerta/historial','/alerta/compartidas','/contactos-emergencia']) await send('GET',route,undefined,first);
 const eventId=crypto.randomUUID();
 const alertBody={origen:'BOTON',eventoId:eventId,latitud:0,longitud:0,bateriaPorcentaje:37};
 const created=await send('POST','/alerta',alertBody,first); if(!created.data?.id) throw new Error('No se pudo registrar el SOS sintético');
 const id=created.data.id;
 check('Registra SOS con ubicación sintética y batería',created.status===201,created.status);
 const duplicate=await send('POST','/alerta',{...alertBody,eventoId:crypto.randomUUID()},first);
 check('Conserva una sola alerta activa',duplicate.data?.id===id&&duplicate.data?.yaActiva===true,duplicate.status);
 const invalid=await send('POST','/alerta',{bateriaPorcentaje:101},first);check('Rechaza porcentajes de batería fuera de rango',invalid.status===400,invalid.status);
 const foreign=await send('PATCH','/alerta/'+id+'/ubicacion',{latitud:1,longitud:1},second);check('Impide cambiar ubicación de otra cuenta',[403,404].includes(foreign.status),foreign.status);
 const foreignContact=await send('DELETE','/contactos-emergencia/1',undefined,second);check('Impide eliminar contactos de otra cuenta',[403,404].includes(foreignContact.status),foreignContact.status);
 const numeric=await send('GET','/alerta/publica/'+id);check('No expone alertas por identificador numérico anónimo',[403,404].includes(numeric.status),numeric.status);
 await send('GET','/alerta/publica/'+eventId);
 await send('PATCH','/alerta/'+id+'/ubicacion',{latitud:0,longitud:0},first);
 const contactBody={nombre:'Contacto ZAP',telefono:'+56900000004',relacion:'Prueba'};
 await send('POST','/contactos-emergencia',contactBody,first);
 await send('GET','/contactos-emergencia/confirmar/token-sintetico-invalido');
 const registerBody={nombre:'Registro',apellido:'Prueba ZAP',telefono:'+56900000005',email:'registro.zap@example.invalid',password:'SafeAlert-ZAP-Test-2026!'};
 await send('POST','/auth/register',registerBody);
 await zap('spider','action','setOptionProcessForm',{Boolean:'false'});
 await zap('spider','action','setOptionPostForm',{Boolean:'false'});
 await zap('spider','action','setOptionMaxDuration',{Integer:'2'});
 await zap('spider','action','setOptionMaxDepth',{Integer:'3'});
 summary.spiderId=(await zap('spider','action','scan',{url:base+'/',contextName,recurse:'true',subtreeOnly:'true'})).scan;
 console.log(JSON.stringify({phase:'spider',id:summary.spiderId}));
 while(Number((await zap('spider','view','status',{scanId:summary.spiderId})).status)<100) await wait(1500);
 await zap('ascan','action','addScanPolicy',{scanPolicyName:policy,alertThreshold:'MEDIUM',attackStrength:'LOW'});
 await zap('ascan','action','disableAllScanners',{scanPolicyName:policy});
 summary.activeRules=['6','20019','40003','40008','40012','40018'];
 await zap('ascan','action','enableScanners',{ids:summary.activeRules.join(','),scanPolicyName:policy});
 await zap('ascan','action','setOptionThreadPerHost',{Integer:'2'});
 await zap('ascan','action','setOptionMaxScanDurationInMins',{Integer:'2'});
 await zap('ascan','action','setOptionMaxRuleDurationInMins',{Integer:'1'});
 const ruleName='SafeAlert-sesion-sintetica-local';
 await zap('replacer','action','addRule',{description:ruleName,enabled:'true',matchType:'REQ_HEADER',matchRegex:'false',matchString:'Cookie',replacement:'safealert_session='+first,url:'^http://127[.]0[.]0[.]1:4300/.*$'});
 try {
 const targets=[['POST','/auth/login',{email:'zap.uno@example.invalid',password:'SafeAlert-ZAP-Test-2026!'}],['POST','/auth/register',registerBody],['POST','/alerta',alertBody],['PATCH','/alerta/'+id+'/ubicacion',{latitud:0,longitud:0}],['POST','/contactos-emergencia',contactBody],['GET','/alerta/publica/'+eventId,undefined]];
 for(let offset=0;offset<targets.length;offset+=2){
  const jobs=[];
  for(const [method,route,body] of targets.slice(offset,offset+2)){
   const result=await zap('ascan','action','scan',{url:base+route,recurse:'false',inScopeOnly:'true',scanPolicyName:policy,method,...(body?{postData:JSON.stringify(body)}:{}),contextId:summary.contextId});
   const job={id:result.scan,method,route};summary.scans.push(job);jobs.push(job);
   console.log(JSON.stringify({phase:'active-scan-started',...job}));
  }
  while(true){const progress=await Promise.all(jobs.map(async j=>({id:j.id,status:(await zap('ascan','view','status',{scanId:j.id})).status})));console.log(JSON.stringify({phase:'active-scan-progress',progress}));if(progress.every(p=>Number(p.status)>=100))break;await wait(12000);}
 }
 }finally{await zap('replacer','action','removeRule',{description:ruleName});}
 for(let i=0;i<90;i++){const pending=Number((await zap('pscan','view','recordsToScan')).recordsToScan);if(!pending)break;await wait(1000);}
 summary.finishedAt=new Date().toISOString();
 summary.alertCounts=(await zap('alert','view','alertsSummary',{baseurl:base})).alertsSummary;
 const alerts=(await zap('alert','view','alerts',{baseurl:base,start:'0',count:'10000'})).alerts;
 fs.writeFileSync(path.join(out,'zap-alertas.json'),JSON.stringify(alerts,null,2));
 fs.writeFileSync(path.join(out,'ejecucion.json'),JSON.stringify(summary,null,2));
 require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'finish-report.cjs'), out], { stdio: 'inherit' });
 const finished = JSON.parse(fs.readFileSync(path.join(out, 'ejecucion.json'), 'utf8'));
 console.log(JSON.stringify({phase:'finished',out,counts:finished.alertCounts,checks:finished.checks.length,failed:finished.checks.filter(c=>c.result==='FAIL').length}));
})().catch(error=>{fs.writeFileSync(path.join(out,'ejecucion-parcial.json'),JSON.stringify(summary,null,2));console.error(error.message.split('?')[0]);process.exitCode=1});
