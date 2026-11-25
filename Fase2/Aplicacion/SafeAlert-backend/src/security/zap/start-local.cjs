// Laboratorio ZAP/JMeter/Postman: controladores reales y datos sintéticos en memoria.
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const backend = path.resolve(__dirname, '../../..');
process.chdir(backend);
const loadProfile = process.env.SAFEALERT_LAB_PROFILE === 'jmeter';
const integrationProfile = process.env.SAFEALERT_LAB_PROFILE === 'postman';
const httpPort = integrationProfile ? 4500 : loadProfile ? 4400 : 4300;
const databasePort = integrationProfile ? 54359 : loadProfile ? 54349 : 54339;
const labUrl = 'http://127.0.0.1:' + httpPort;
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.GREEN_API_ID_INSTANCE = integrationProfile ? 'local-postman' : '';
process.env.GREEN_API_TOKEN_INSTANCE = integrationProfile ? 'local-only' : '';
process.env.GREEN_API_URL = integrationProfile ? labUrl + '/__lab/green-api' : 'http://127.0.0.1:1';
process.env.FRONTEND_URL = labUrl;
process.env.BACKEND_PUBLIC_URL = labUrl;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Salida externa bloqueada en el laboratorio');
  if (integrationProfile && url.origin !== labUrl) throw new Error('Postman: solo se permite el receptor HTTP simulado del laboratorio');
  return originalFetch(input, options);
};
(async () => {
  require('reflect-metadata');
  const runtime = createRequire(path.join(__dirname, 'runtime/package.json'));
  const { PGlite } = runtime('@electric-sql/pglite');
  const { PGLiteSocketServer } = runtime('@electric-sql/pglite-socket');
  const { DataSource } = require('typeorm');
  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const cookieParser = require('cookie-parser');
  const express = require('express');
  const { Usuario } = require(path.join(backend, 'dist/database/entities/usuario.entity.js'));
  const { ContactoEmergencia } = require(path.join(backend, 'dist/database/entities/contacto-emergencia.entity.js'));
  const { Alerta } = require(path.join(backend, 'dist/database/entities/alerta.entity.js'));
  const db = await PGlite.create();
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: databasePort, maxConnections: 2 });
  await socket.start();
  const source = new DataSource({ type: 'postgres', host: '127.0.0.1', port: databasePort, username: 'postgres', database: 'postgres', ssl: false, entities: [Usuario, ContactoEmergencia, Alerta], synchronize: true, extra: { max: 1 } });
  await source.initialize();
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash(loadProfile ? 'SafeAlert-JMeter-2026!' : 'SafeAlert-ZAP-Test-2026!', 10);
  const seedUsers = [
    { nombre: 'Prueba', apellido: 'ZAP Uno', telefono: '+56900000001', email: 'zap.uno@example.invalid', passwordHash },
    { nombre: 'Prueba', apellido: 'ZAP Dos', telefono: '+56900000002', email: 'zap.dos@example.invalid', passwordHash },
  ];
  if (loadProfile) for (let index = 1; index <= 50; index++) seedUsers.push({
    nombre: 'JMeter', apellido: 'Usuario ' + index,
    telefono: '+569' + String(index).padStart(8, '0'),
    email: 'jmeter.' + index + '@example.invalid', passwordHash,
  });
  const users = await source.getRepository(Usuario).save(seedUsers);
  if (loadProfile) await source.getRepository(ContactoEmergencia).save(users.filter(user => user.email.startsWith('jmeter.')).map(user => ({
    nombre: 'Contacto sintético JMeter', telefono: '+56900009000', relacion: 'Pruebas', usuario: user,
    confirmado: true, rechazado: false, notificarActivo: true,
  })));
  await source.getRepository(ContactoEmergencia).save({ nombre: 'Contacto sintético', telefono: '+56900000003', relacion: 'Pruebas', usuario: users[0], confirmado: true, rechazado: false, notificarActivo: true });
  const { AppModule } = require(path.join(backend, 'dist/app.module.js'));
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DataSource).useValue(source).compile();
  const app = module.createNestApplication({ logger: loadProfile || integrationProfile ? ['error'] : ['error', 'warn'] });
  const { configureHttpSecurity } = require(path.join(backend, 'dist/security/http/http-security.js'));
  configureHttpSecurity(app);
  app.use(cookieParser());
  if (loadProfile || integrationProfile) app.use('/__lab/status', (_req, res) => res.json({
    profile: integrationProfile ? 'postman' : 'jmeter', host: '127.0.0.1', port: httpPort, pid: process.pid,
    providerSimulated: integrationProfile,
    database: 'PGlite en memoria; pool de una conexión', syntheticUsers: loadProfile ? 50 : 2,
    externalMessagingEnabled: false, externalFetchBlocked: true, memory: process.memoryUsage(), cpu: process.cpuUsage(), uptime: process.uptime(),
  }));
  if (integrationProfile) require('../postman/lab-fixtures.cjs').attach(app, express);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: [labUrl, 'http://localhost:' + httpPort], credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'] });
  const www = path.resolve(backend, '../SafeAlert-frontend/www');
  // Solo cambia el destino de la API en la copia servida: los archivos del frontend no se editan.
  app.use((req, res, next) => {
    const filename = path.basename(req.path);
    if (req.method === 'GET' && filename.endsWith('.js') && /^[-a-zA-Z0-9_.]+$/.test(filename)) {
      const file = path.join(www, filename);
      if (fs.existsSync(file)) return res.type('application/javascript').send(fs.readFileSync(file, 'utf8').replaceAll('https://safealert-api-299712175128.southamerica-west1.run.app', labUrl));
    }
    next();
  });
  // Las rutas API las atienden los controladores reales; no hay un proxy hacia GCP.
  const spaRoutes = ['/', '/home', '/login', '/register', '/profile', '/settings', '/widget-sos', '/emergency-contacts', '/history', '/companion'];
  app.use((req, res, next) => {
    if (req.method === 'GET' && spaRoutes.includes(req.path)) {
      const nonce = crypto.randomBytes(24).toString('hex');
      const nginx = fs.readFileSync(path.resolve(backend, '../SafeAlert-frontend/nginx.conf'), 'utf8');
      const policy = nginx.match(/default "(default-src[^"\n]+)";/)?.[1];
      if (!policy) throw new Error('No se encontró la CSP real del frontend');
      res.setHeader('Content-Security-Policy', policy.replaceAll('$request_id', nonce));
      res.setHeader('Cache-Control', 'no-store');
      return res.type('html').send(fs.readFileSync(path.join(www, 'index.html'), 'utf8').replaceAll('__SAFEALERT_CSP_NONCE__', nonce));
    }
    next();
  });
  app.use(express.static(www, { index: false }));
  await app.listen(httpPort, '127.0.0.1');
  console.log(JSON.stringify({ ready: true, url: labUrl, database: 'PGlite PostgreSQL en memoria', outbound: 'Bloqueado', usuarios: loadProfile ? { cantidad: 50, perfil: 'jmeter' } : users.map(u => ({ id: u.id, email: u.email })) }));
  const stop = async () => { await app.close(); await socket.stop(); await db.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch(error => { console.error(error.message); process.exit(1); });
