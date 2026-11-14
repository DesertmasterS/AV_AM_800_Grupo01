const { zap } = require('./zap-api.cjs');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const out = process.argv[2]; if (!out) throw new Error('Indica la carpeta de la ejecución que se va a evaluar');
const base = 'http://127.0.0.1:4300';
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function send(method, route, body, token) {
 const content = body === undefined ? '' : JSON.stringify(body);
 let request = method + ' ' + base + route + ' HTTP/1.1\r\nHost: 127.0.0.1:4300\r\nConnection: close\r\n';
 if (token) request += 'Cookie: safealert_session=' + token + '\r\n';
 if (body !== undefined) request += 'Content-Type: application/json\r\nContent-Length: ' + Buffer.byteLength(content) + '\r\n';
 const result = (await zap('core','action','sendRequest',{request:request+'\r\n'+content,followRedirects:'false'})).sendRequest[0];
 let json; try { json = JSON.parse(result.responseBody); } catch { json = null; }
 return {status:Number(result.responseHeader.split(' ')[1]),json,body:result.responseBody,headers:result.responseHeader,messageId:result.id};
}
(async () => {
 const summary = JSON.parse(fs.readFileSync(path.join(out,'ejecucion.json'),'utf8'));
 const baselinePath = path.join(__dirname,'output','2026-11-13','ejecucion.json');
 const before = JSON.parse(fs.readFileSync(baselinePath,'utf8'));
 const checks = [];
 const check = (name, pass, evidence) => { checks.push({name,result:pass?'PASS':'FAIL',evidence}); };
 const login = await send('POST','/auth/login',{email:'zap.uno@example.invalid',password:'SafeAlert-ZAP-Test-2026!'});
 if (login.status !== 200) throw new Error('Falló la autenticación sintética de verificación');
 for (const phone of ['no-es-un-telefono','1234567890123456789012345','contactos-emergencia']) {
  const response = await send('POST','/contactos-emergencia',{nombre:'Validación ZAP',telefono:phone,relacion:'Prueba'},login.json.token);
  check('Rechaza teléfono: '+phone,response.status===400,{status:response.status,messageId:response.messageId});
 }
 const update = await send('PATCH','/contactos-emergencia/1',{telefono:'../etc/passwd'},login.json.token);
 check('Rechaza rutas en la actualización de teléfonos',update.status===400,{status:update.status,messageId:update.messageId});
 const valid = await send('POST','/contactos-emergencia',{nombre:'Formato internacional',telefono:'+56 (9) 1234-5679',relacion:'Prueba'},login.json.token);
 check('Normaliza un teléfono internacional válido',valid.status===201&&valid.json?.contacto?.telefono==='+56912345679',{status:valid.status,messageId:valid.messageId});
 const first = await send('GET','/settings'), second = await send('GET','/settings');
 const nonce = first.body.match(/ngcspnonce="([^"]+)"/i)?.[1];
 const nonce2 = second.body.match(/ngcspnonce="([^"]+)"/i)?.[1];
 check('Nonce distinto por respuesta y coherente con CSP de Angular/Ionic',Boolean(nonce&&nonce2&&nonce!==nonce2&&first.headers.includes("'nonce-"+nonce+"'")&&first.body.includes('content="'+nonce+'"')),{messageIds:[first.messageId,second.messageId]});
 const confirmation = await send('GET','/contactos-emergencia/confirmar/token-sintetico-invalido');
 const css = confirmation.body.match(/<style>([\s\S]*?)<\/style>/)?.[1];
 const hash = css === undefined ? '' : crypto.createHash('sha256').update(css).digest('base64');
 check('El hash CSP coincide con el CSS de confirmación',Boolean(hash&&confirmation.headers.includes("'sha256-"+hash+"'")&&!confirmation.headers.includes('unsafe-inline')),{messageId:confirmation.messageId});
 const denied = await send('GET','/alerta/historial');
 check('Las respuestas no autenticadas conservan la protección de cabeceras',denied.status===401&&denied.headers.includes('X-Frame-Options: DENY')&&denied.headers.includes('X-Content-Type-Options: nosniff')&&!/X-Powered-By:/i.test(denied.headers),{status:denied.status,messageId:denied.messageId});
 for (let i=0;i<60;i++) { if(Number((await zap('pscan','view','recordsToScan')).recordsToScan)===0)break; await new Promise(r=>setTimeout(r,500)); }
 const alerts = (await zap('alert','view','alerts',{baseurl:base,start:'0',count:'10000'})).alerts;
 const groups = new Map();
 for (const a of alerts) { const key=a.pluginId+'|'+a.alert; if(!groups.has(key))groups.set(key,{id:a.pluginId,name:a.alert,risk:a.risk,confidence:a.confidence,count:0});groups.get(key).count++; }
 summary.findingTypes=[...groups.values()]; summary.alertCounts=(await zap('alert','view','alertsSummary',{baseurl:base})).alertsSummary;
 summary.additionalChecks=checks;summary.registeredUrls=(await zap('core','view','urls',{baseurl:base})).urls.length;
 summary.finishedAt=new Date().toISOString();summary.source='ae56823 + correcciones locales sin commit, merge ni despliegue';
 summary.angularVersion=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../../SafeAlert-frontend/package.json'),'utf8')).dependencies['@angular/core'];
 const riskTypes = (types, risk) => types.filter(t=>t.risk===risk).length;
 const comparison = {baseline:baselinePath,after:out,countsBefore:before.alertCounts,countsAfter:summary.alertCounts,typesBefore:before.findingTypes,typesAfter:summary.findingTypes,checksBefore:before.checks,checksAfter:summary.checks,additionalChecks:checks,activeRulesIdentical:JSON.stringify(before.activeRules)===JSON.stringify(summary.activeRules),limits:'Mismo host, entidades, datos iniciales, seis reglas LOW y límites de tiempo. El frontend actualizado usa más fragmentos JS, por lo que las instancias por recurso pueden variar. Políticas HTTP del código real aplicadas al laboratorio; Nginx y TLS no se ejecutaron en esta prueba.'};
 fs.writeFileSync(path.join(out,'ejecucion.json'),JSON.stringify(summary,null,2));
 fs.writeFileSync(path.join(out,'zap-alertas.json'),JSON.stringify(alerts,null,2));
 fs.writeFileSync(path.join(out,'comparacion.json'),JSON.stringify(comparison,null,2));
 const title='SafeAlert · ZAP después de correcciones · '+new Date().toLocaleDateString('es-CL',{timeZone:'America/Santiago'});
 await zap('reports','action','generate',{title,template:'traditional-html',description:summary.source+'. '+comparison.limits+' Los resultados corresponden únicamente a la instancia local, no a producción ni a Android nativo.',contexts:summary.context,sites:base,reportDir:out,reportFileName:'SafeAlert-ZAP.html',display:'false'});
 const rows = ['High','Medium','Low','Informational'].map(r=>'<tr><td>'+esc(r)+'</td><td>'+riskTypes(before.findingTypes,r)+'</td><td>'+riskTypes(summary.findingTypes,r)+'</td><td>'+before.alertCounts[r]+'</td><td>'+summary.alertCounts[r]+'</td></tr>').join('');
 const body='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font:16px/1.65 system-ui;color:#163e39;background:#f3f7f4;margin:0}main{max-width:1050px;margin:auto;padding:32px 20px}section,header{background:white;border:1px solid #d8e6dc;border-radius:16px;padding:24px;margin:0 0 20px}header{border-top:6px solid #246d60}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #dce7df}a{color:#246d60}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#edf4ef;padding:14px}h1{font-size:30px}small{color:#607a70}</style><main><header><small>'+esc(summary.source)+'</small><h1>Comparación de seguridad de SafeAlert</h1><p>Objetivo: '+base+'. Datos sintéticos, PostgreSQL embebido PGlite y mensajería externa bloqueada.</p><p>Angular actualizado a '+esc(summary.angularVersion)+'. Backend: validación E.164 al crear y actualizar, CSP por hash para el HTML de confirmación, protección anti-clickjacking, nosniff y supresión de X-Powered-By. Frontend: CSP con nonce por respuesta, estilos de Angular/Ionic autorizados y lista limitada para Leaflet.</p></header><section><h2>Antes y después</h2><table><tr><th>Riesgo</th><th>Tipos antes</th><th>Tipos después</th><th>Instancias antes</th><th>Instancias después</th></tr>'+rows+'</table><p>Los tipos son categorías distintas. Las instancias corresponden a URL y parámetros; no equivalen a vulnerabilidades diferentes.</p><p>'+esc(comparison.limits)+'</p><p>La alerta alta anterior de ruta transversal era un indicio de confianza baja: no demostró lectura de archivos. Ahora se prueba además el rechazo explícito del texto usado en aquel aviso.</p></section><section><h2>Verificación funcional comparable</h2><p>'+summary.checks.filter(c=>c.result==='PASS').length+'/'+summary.checks.length+' verificaciones originales aprobadas; '+summary.scans.length+' escaneos activos finalizados. Reglas idénticas: '+comparison.activeRulesIdentical+'.</p><table><tr><th>Prueba</th><th>Resultado</th></tr>'+summary.checks.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.result)+'</td></tr>').join('')+'</table></section><section><h2>Comprobaciones de las correcciones</h2><table><tr><th>Prueba</th><th>Resultado</th><th>Evidencia</th></tr>'+checks.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.result)+'</td><td>'+esc(JSON.stringify(c.evidence))+'</td></tr>').join('')+'</table></section><section><h2>Alertas que permanecen</h2><table><tr><th>Regla</th><th>Descripción</th><th>Riesgo</th><th>Instancias</th></tr>'+summary.findingTypes.map(a=>'<tr><td>'+esc(a.id)+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.risk)+'</td><td>'+a.count+'</td></tr>').join('')+'</table></section><section><h2>Alcance</h2><ul>'+summary.limitations.map(s=>'<li>'+esc(s)+'</li>').join('')+'<li>Exploración tradicional y rutas sembradas; no se hizo un escaneo DOM/AJAX exhaustivo.</li><li>La compilación de producción y las pruebas unitarias se validan aparte de ZAP. Persisten advertencias previas del presupuesto SCSS de Contactos y de navegadores antiguos no soportados.</li><li>La auditoría npm adicional detecta avisos en herramientas de desarrollo; el objetivo comparativo es el conjunto de hallazgos ZAP. No se afirma ausencia general de vulnerabilidades.</li></ul><p>Los cambios permanecen locales. No se realizó merge ni despliegue.</p><p><a href="SafeAlert-ZAP.html">Reporte nativo de ZAP</a> · <a href="comparacion.json">Comparación JSON</a> · <a href="ejecucion.json">Ejecución</a> · <a href="zap-alertas.json">Alertas</a></p><p><a href="https://github.com/angular/angular/security/advisories/GHSA-hh8m-fm6v-7cvg">Aviso oficial de Angular</a></p></section></main></html>';
 fs.writeFileSync(path.join(out,'Comparacion-SafeAlert.html'),body);
 const failed=checks.filter(c=>c.result==='FAIL');
 console.log(JSON.stringify({out,counts:summary.alertCounts,types:summary.findingTypes,checks:summary.checks.length,additional:checks.length,failed:failed.length}));
 if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error.message.split('?')[0]);process.exitCode=1;});
