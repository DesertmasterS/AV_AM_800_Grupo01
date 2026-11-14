const fs = require('node:fs');
const path = require('node:path');
async function zap(component, type, method, parameters = {}, format = 'JSON') {
  const config = fs.readFileSync(path.join(process.env.USERPROFILE, 'ZAP/config.xml'), 'utf8');
  const api = config.split('<api>')[1]?.split('</api>')[0] || '';
  const key = api.match(/<key>([^<]+)<\/key>/)?.[1];
  if (!key) throw new Error('No se encontró la clave de la API local de ZAP');
  const query = new URLSearchParams({ apikey: key, ...parameters });
  const response = await fetch('http://127.0.0.1:8080/' + format + '/' + component + '/' + type + '/' + method + '/?' + query, { signal: AbortSignal.timeout(60000) });
  const body = await response.text();
  if (format !== 'JSON') return body;
  const json = JSON.parse(body);
  if (!response.ok || json.code) throw new Error('ZAP: ' + (json.code || response.status) + ' ' + (json.message || ''));
  return json;
}
module.exports = { zap };
if (require.main === module) zap(process.argv[2], process.argv[3], process.argv[4], JSON.parse(process.argv[5] || '{}')).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message.split('?')[0]); process.exitCode = 1; });
