const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
require('./build-plan.cjs');
const installation = path.join(process.env.LOCALAPPDATA, 'Programs/Apache/apache-jmeter-5.6.3');
const java = path.join(process.env.LOCALAPPDATA, 'Programs/EclipseAdoptium/temurin-21/jdk-21.0.12.1+1/bin/java.exe');
const output = path.join(__dirname, 'output', new Date().toISOString().slice(0, 10), String(Date.now()));
fs.mkdirSync(output, { recursive: true });
console.log('INFORME: ' + output);
const scenarios = process.argv.includes('--smoke') ? [{ users: 1, ramp: 1, duration: 10 }] : [
  { users: 1, ramp: 1, duration: 10 }, { users: 5, ramp: 5, duration: 45 },
  { users: 10, ramp: 10, duration: 60 }, { users: 25, ramp: 15, duration: 60 },
];
// Lee CSV RFC4180, incluyendo mensajes de aserción que contengan comas.
function csv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (row.length || field) { row.push(field); rows.push(row); }
  const header = rows.shift(); return rows.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
function stats(rows) {
  if (!rows.length) return { count: 0, errors: 0, errorPercent: 100, p95: null };
  const elapsed = rows.map(r => +r.elapsed).sort((a, b) => a - b);
  const percentile = p => elapsed[Math.ceil(p * elapsed.length) - 1];
  const errors = rows.filter(r => r.success !== 'true').length;
  const seconds = (Math.max(...rows.map(r => +r.timeStamp + +r.elapsed)) - Math.min(...rows.map(r => +r.timeStamp))) / 1000;
  return { count: rows.length, errors, errorPercent: errors / rows.length * 100,
    p50: percentile(.5), p90: percentile(.9), p95: percentile(.95), p99: percentile(.99),
    max: elapsed.at(-1), requestsPerSecond: +(rows.length / seconds).toFixed(2), measuredSeconds: +seconds.toFixed(2) };
}
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const report = { target: 'http://127.0.0.1:4400', startedAt: new Date().toISOString(), jmeter: '5.6.3', java: '21.0.12', thinkMs: 200,
  database: 'PGlite en memoria, pool de una conexión; no es Neon', syntheticUsers: 50,
  externalMessaging: false, stages: [], thresholds: { note: 'Guardas orientativas para no aumentar carga ante degradación; no son SLA acordados', errorPercent: 2, p95Ms: 5000 } };
function save() {
  fs.writeFileSync(path.join(output, 'resultados.json'), JSON.stringify(report, null, 2));
  const table = report.stages.map(s => `<tr><td>${s.users}</td><td>${s.duration} s</td><td>${s.load.count}</td><td>${s.allErrors}</td><td>${s.load.errorPercent.toFixed(2)}%</td><td>${s.load.p50 ?? '—'}</td><td>${s.load.p95 ?? '—'}</td><td>${s.load.p99 ?? '—'}</td><td>${s.load.requestsPerSecond ?? '—'}</td><td>${s.finishedSos}</td><td><a href="${s.folder}/dashboard/index.html">Panel</a> · <a href="${s.folder}/results.jtl">CSV</a></td></tr>`).join('');
  const endpoints = report.stages.map(s => `<h2>${s.users} usuarios virtuales</h2><table><tr><th>Operación</th><th>Peticiones</th><th>Errores</th><th>P95 ms</th></tr>${Object.entries(s.endpoints).map(([k,v]) => `<tr><td>${escape(k)}</td><td>${v.count}</td><td>${v.errors}</td><td>${v.p95}</td></tr>`).join('')}</table>`).join('');
  fs.writeFileSync(path.join(output, 'Informe-SafeAlert-JMeter.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>SafeAlert · Pruebas de carga</title><style>body{font:16px system-ui;background:#eff4f8;color:#16263b;max-width:1200px;margin:40px auto;padding:24px}h1{color:#133f65}table{border-collapse:collapse;background:white;width:100%;margin:20px 0}td,th{text-align:left;padding:12px;border-bottom:1px solid #dce4ed}th{background:#123b59;color:white}a{color:#075ca0}.note{background:#fff5d6;padding:18px;border-radius:10px}</style><h1>SafeAlert · Pruebas de carga con JMeter</h1><p>Inicio: ${report.startedAt}. Apache JMeter 5.6.3; Java 21. Datos sintéticos, ejecución local y sin mensajes de WhatsApp.</p><div class="note">Estos resultados miden el laboratorio NestJS + PGlite con una sola conexión, compartiendo PC con JMeter. No estiman la capacidad de Cloud Run ni de Neon. No incluyen Android, sensores, red móvil, TLS, interfaz web ni entrega de WhatsApp. No hay un SLA de rendimiento acordado.</div><h2>Resultados</h2><p>Los percentiles y solicitudes/s corresponden a las siete operaciones CARGA. La columna de errores totales incluye también preparación e inicio de sesión. Usuarios se incorporan progresivamente; duración incluye esa rampa. Cada petición tiene una pausa previa de 200 ms. Se usa una cuenta y sesión independiente por usuario.</p><table><tr><th>Usuarios</th><th>Duración</th><th>Peticiones CARGA</th><th>Errores totales</th><th>Error CARGA</th><th>P50 ms</th><th>P95 ms</th><th>P99 ms</th><th>Peticiones/s</th><th>SOS finalizados</th><th>Detalle</th></tr>${table}</table><p>${escape(report.stoppedReason || 'Escenarios ejecutados según el plan.')}</p><h2>Qué se verificó</h2><p>Sesión correcta por cuenta, lectura de perfil y contactos, creación de un SOS nuevo, actualización de ubicación sintética, seguimiento activo, finalización e historial. Códigos HTTP y aserciones funcionales. El envío externo está deshabilitado. Las sesiones y datos viven solo en el proceso del laboratorio.</p>${endpoints}<h2>Reproducibilidad y alcance</h2><p>Plan: <a href="SafeAlert-carga-local.jmx">SafeAlert-carga-local.jmx</a>. Datos y métricas: <a href="resultados.json">resultados.json</a>. Los paneles nativos incluyen también SETUP, por lo que sus agregados pueden diferir. Percentiles por rango más cercano. Una petición de supervisión por segundo, fuera del JTL, consulta la memoria del laboratorio. Las alertas sintéticas se acumulan entre etapas y el historial crece; no se extrapola este ensayo corto a estabilidad prolongada.</p></html>`);
}
async function labStatus() { const r = await fetch(report.target + '/__lab/status', { signal: AbortSignal.timeout(4000) }); if (!r.ok) throw new Error('Laboratorio no disponible'); const data = await r.json(); if (data.profile !== 'jmeter' || data.externalMessagingEnabled !== false || !data.externalFetchBlocked) throw new Error('Laboratorio no aislado'); return data; }
(async () => {
  report.lab = await labStatus();
  fs.copyFileSync(path.join(__dirname, 'SafeAlert-carga-local.jmx'), path.join(output, 'SafeAlert-carga-local.jmx'));
  for (const scenario of scenarios) {
    const folder = 'usuarios-' + scenario.users, dest = path.join(output, folder); fs.mkdirSync(dest);
    const metrics = []; let monitoring = false;
    const timer = setInterval(async () => { if (monitoring) return; monitoring = true; try { metrics.push({ time: Date.now(), ...(await labStatus()) }); } catch (e) { metrics.push({ time: Date.now(), error: e.message }); } finally { monitoring = false; } }, 1000);
    console.log('INICIO ' + JSON.stringify(scenario));
    const args = ['-Xms256m', '-Xmx768m', '-Djava.awt.headless=true', '-jar', path.join(installation, 'bin/ApacheJMeter.jar'), '-n', '-t', path.join(__dirname, 'SafeAlert-carga-local.jmx'), '-l', path.join(dest, 'results.jtl'), '-j', path.join(dest, 'jmeter.log'), '-e', '-o', path.join(dest, 'dashboard'), '-Jusers=' + scenario.users, '-Jramp=' + scenario.ramp, '-Jduration=' + scenario.duration, '-Jthink_ms=200', '-Jjmeter.save.saveservice.output_format=csv', '-Jjmeter.save.saveservice.print_field_names=true', '-Jjmeter.save.saveservice.response_data=false', '-Jjmeter.save.saveservice.responseHeaders=false', '-Jjmeter.save.saveservice.requestHeaders=false', '-Jjmeter.reportgenerator.overall_granularity=1000'];
    const log = fs.createWriteStream(path.join(dest, 'console.log'));
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(java, args, { cwd: path.join(installation, 'bin'), windowsHide: true });
      child.stdout.on('data', b => { log.write(b); const text = b.toString(); if (/summary|Error|end of run/i.test(text)) process.stdout.write(text); });
      child.stderr.on('data', b => log.write(b)); child.on('error', reject); child.on('close', resolve);
    }).finally(() => { clearInterval(timer); log.end(); });
    fs.writeFileSync(path.join(dest, 'lab-metrics.json'), JSON.stringify(metrics, null, 2));
    if (exitCode !== 0 || !fs.existsSync(path.join(dest, 'results.jtl'))) throw new Error('JMeter falló; revisar ' + dest);
    const rows = csv(fs.readFileSync(path.join(dest, 'results.jtl'), 'utf8'));
    const load = rows.filter(r => r.label.startsWith('CARGA -'));
    const endpoints = Object.fromEntries([...new Set(load.map(r => r.label))].map(label => [label, stats(load.filter(r => r.label === label))]));
    const stage = { ...scenario, folder, load: stats(load), totalSamples: rows.length, allErrors: rows.filter(r => r.success !== 'true').length,
      peakThreads: Math.max(0, ...rows.map(r => +r.allThreads)), finishedSos: rows.filter(r => r.label === 'CARGA - Finalizar SOS' && r.success === 'true').length,
      endpoints, failures: rows.filter(r => r.success !== 'true').slice(0, 20), maxLabRssMiB: Math.max(0, ...metrics.map(m => (m.memory?.rss || 0) / 1048576)) };
    report.stages.push(stage);
    console.log('RESULTADO ' + JSON.stringify({ users: stage.users, ...stage.load, allErrors: stage.allErrors, finishedSos: stage.finishedSos }));
    if (stage.allErrors || stage.load.p95 > 5000 || !stage.finishedSos) { report.stoppedReason = 'Se detuvo el aumento de carga por errores, ausencia de ciclos SOS completos o P95 superior a 5 segundos. Revisar el detalle antes de repetir.'; save(); break; }
    save();
  }
  report.finishedAt = new Date().toISOString(); save(); console.log('FINALIZADO ' + path.join(output, 'Informe-SafeAlert-JMeter.html'));
})().catch(e => { report.error = e.stack; report.stoppedReason = e.message; save(); console.error(e); process.exitCode = 1; });
