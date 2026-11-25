// Colección Postman v2.1. Solo datos sintéticos; destino fijo al laboratorio local.
const fs = require('node:fs');
const path = require('node:path');
const requests = [];
function add(name, method, route, body, code, tests = '', auth, html = false) {
  const header = [{ key: 'Content-Type', value: 'application/json' }];
  if (auth) header.push({ key: 'Cookie', value: `safealert_session={{token_${auth}}}` });
  const request = { method, header, url: 'http://127.0.0.1:4500' + route };
  if (body !== undefined) request.body = { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body), options: { raw: { language: 'json' } } };
  const exec = [`pm.test('HTTP ${code}', () => pm.response.to.have.status(${code}));`,
    `pm.test('Cabecera de protección nosniff', () => pm.expect(pm.response.headers.get('X-Content-Type-Options')).to.eql('nosniff'));`,
    ...(html ? [`const html = pm.response.text();`, `pm.test('Respuesta HTML con CSP', () => { pm.expect(pm.response.headers.get('Content-Type')).to.include('text/html'); pm.expect(pm.response.headers.get('Content-Security-Policy')).to.include("default-src 'none'"); });`] : code !== 204 && !(method === 'DELETE' && code === 200) ? ['const data = pm.response.json();'] : []),
    tests];
  requests.push({ name: String(requests.length + 1).padStart(2, '0') + ' · ' + name, request, protocolProfileBehavior: { disableCookies: true, followRedirects: false }, event: [{ listen: 'test', script: { type: 'text/javascript', exec } }] });
}
const test = (name, code) => `pm.test(${JSON.stringify(name)}, () => { ${code} });`;
const save = (key, expression) => `pm.collectionVariables.set('${key}', ${expression});`;
const assert = expression => `pm.expect(${expression}).to.eql(true);`;
const token = who => save('token_' + who, 'data.token') + save('user_' + who, 'data.usuario.id');
const reg = who => ({ nombre: 'Postman ' + who, apellido: 'Integracion', telefono: who === 'a' ? '+56900007001' : '+56900007002', email: '{{email_' + who + '}}', password: '{{password}}' });
const contact = { nombre: 'Contacto sintetico Postman', telefono: '+56 9 0000 8001', relacion: 'Pruebas locales' };
const sos = (origin = 'BOTON', event = '{{$guid}}') => ({ origen: origin, eventoId: event, latitud: 0, longitud: 0, bateriaPorcentaje: 73 });
add('Verificar laboratorio y crear identidad de ejecución', 'GET', '/__lab/status', undefined, 200,
  test('Entorno local aislado y proveedor simulado', `pm.expect(data.profile).to.eql('postman'); pm.expect(data.externalMessagingEnabled).to.eql(false); pm.expect(data.externalFetchBlocked).to.eql(true); pm.expect(data.providerSimulated).to.eql(true);`) +
  `if(data.profile !== 'postman' || data.externalMessagingEnabled !== false || data.providerSimulated !== true) { pm.execution.setNextRequest(null); throw new Error('Laboratorio no aislado'); }
  const run = Date.now() + '-' + Math.random().toString(36).slice(2,8); pm.collectionVariables.set('run_id', run);
  pm.collectionVariables.set('email_a', 'postman.a.' + run + '@example.invalid'); pm.collectionVariables.set('email_b', 'postman.b.' + run + '@example.invalid');
  pm.collectionVariables.set('password', 'Local-Postman-2026!'); pm.collectionVariables.set('event_first', pm.variables.replaceIn('{{$guid}}'));`);
add('Registrar punto inicial del receptor simulado', 'GET', '/__lab/outbox', undefined, 200,
  test('Receptor simulado disponible', `pm.expect(data.simulated).to.eql(true); pm.expect(data.messages).to.be.an('array');`) + save('outbox_start', 'data.messages.length'));
add('Perfil sin sesión se rechaza', 'GET', '/auth/me', undefined, 401);
add('Registro con datos inválidos se rechaza', 'POST', '/auth/register', { nombre: 'X', apellido: '', telefono: 'abc', email: 'incorrecto', password: '123' }, 400);
add('Registrar cuenta A', 'POST', '/auth/register', reg('a'), 201, token('a') + test('Datos públicos sin clave ni hash', `pm.expect(data.usuario.email).to.eql(pm.collectionVariables.get('email_a')); pm.expect(data.usuario).not.to.have.property('password'); pm.expect(data.usuario).not.to.have.property('passwordHash'); pm.expect(data.token).to.be.a('string');`));
add('Registro duplicado se rechaza', 'POST', '/auth/register', reg('a'), 409);
add('Clave incorrecta se rechaza', 'POST', '/auth/login', { email: '{{email_a}}', password: 'Incorrecta-2026!' }, 401);
add('Iniciar sesión A', 'POST', '/auth/login', { email: '{{email_a}}', password: '{{password}}' }, 200, token('a') + test('Cookie de sesión HttpOnly y cuenta correcta', `pm.expect(pm.response.headers.get('Set-Cookie')).to.include('HttpOnly'); pm.expect(data.usuario.email).to.eql(pm.collectionVariables.get('email_a'));`));
add('Leer perfil A mediante cookie', 'GET', '/auth/me', undefined, 200, test('La sesión corresponde a A', `pm.expect(data.usuario.id).to.eql(Number(pm.collectionVariables.get('user_a')));`), 'a');
add('Registrar cuenta independiente B', 'POST', '/auth/register', reg('b'), 201, token('b') + test('Las cuentas son diferentes', `pm.expect(data.usuario.id).not.to.eql(Number(pm.collectionVariables.get('user_a')));`));
add('Contactos A inicialmente vacíos', 'GET', '/contactos-emergencia', undefined, 200, test('Sin contactos previos', `pm.expect(data.contactos).to.eql([]);`), 'a');
add('Teléfono inválido se rechaza', 'POST', '/contactos-emergencia', { nombre: 'Invalido', telefono: '../../etc/passwd' }, 400, '', 'a');
add('Crear contacto A y normalizar teléfono', 'POST', '/contactos-emergencia', contact, 201, save('contact_id', 'data.contacto.id') + test('Contacto pendiente y teléfono normalizado', `pm.expect(data.contacto.telefono).to.eql('+56900008001'); pm.expect(data.contacto.confirmado).to.eql(false); pm.expect(data.contacto).not.to.have.property('tokenConfirmacion');`), 'a');
add('Contacto duplicado se rechaza', 'POST', '/contactos-emergencia', contact, 409, '', 'a');
add('Persistencia del contacto creado', 'GET', '/contactos-emergencia', undefined, 200, test('Contacto almacenado y token oculto', `pm.expect(data.contactos).to.have.lengthOf(1); pm.expect(data.contactos[0].id).to.eql(Number(pm.collectionVariables.get('contact_id'))); pm.expect(data.contactos[0]).not.to.have.property('tokenConfirmacion');`), 'a');
add('Reenvío antes de 48 horas se rechaza', 'POST', '/contactos-emergencia/{{contact_id}}/reenviar', {}, 409, test('Se informa la espera de invitaciones', `pm.expect(data.message).to.include('48h');`), 'a');
add('Revisar invitación en receptor simulado', 'GET', '/__lab/outbox', undefined, 200, `const current = data.messages.slice(Number(pm.collectionVariables.get('outbox_start')));` + test('Una sola invitación para el destinatario ficticio', `pm.expect(current).to.have.lengthOf(1); pm.expect(current[0].chatId).to.eql('56900008001@c.us'); pm.expect(current[0].message).to.include('48 horas');`) + `const match = current[0].message.match(new RegExp('confirmar/([a-f0-9-]{36})', 'i')); pm.test('Invitación con código UUID', () => pm.expect(match).not.to.eql(null)); if(match) pm.collectionVariables.set('confirmation_token', match[1]);`);
add('Abrir página de confirmación', 'GET', '/contactos-emergencia/confirmar/{{confirmation_token}}', undefined, 200, test('Se ofrece aceptar o rechazar', `pm.expect(html).to.include('aceptas ser contacto'); pm.expect(html).to.include('Rechazar');`), undefined, true);
add('Confirmar contacto mediante enlace', 'POST', '/contactos-emergencia/confirmar/{{confirmation_token}}', {}, 200, test('La aceptación es exitosa', `pm.expect(html).to.include('Solicitud confirmada con éxito');`), undefined, true);
add('Comprobar confirmación persistida', 'GET', '/contactos-emergencia', undefined, 200, test('Contacto confirmado y notificaciones activas', `pm.expect(data.contactos[0].confirmado).to.eql(true); pm.expect(data.contactos[0].notificarActivo).to.eql(true);`), 'a');
add('SOS con coordenadas incompletas se rechaza', 'POST', '/alerta', { origen: 'BOTON', latitud: 0 }, 400, '', 'a');
add('Batería fuera del rango se rechaza', 'POST', '/alerta', { ...sos(), bateriaPorcentaje: 101 }, 400, '', 'a');
add('Movimiento sin UUID se rechaza', 'POST', '/alerta', { origen: 'MOVIMIENTO', latitud: 0, longitud: 0 }, 400, '', 'a');
add('Crear SOS de botón con batería', 'POST', '/alerta', sos('BOTON', '{{event_first}}'), 201, save('alert_first', 'data.id') + test('Nuevo SOS y coordenadas cero válidas', `pm.expect(data.id).to.be.a('number'); pm.expect(data.duplicada).to.eql(false); pm.expect(data.origen).to.eql('BOTON'); pm.expect(Number(data.latitud)).to.eql(0); pm.expect(Number(data.longitud)).to.eql(0);`), 'a');
add('Validar mensaje SOS sin enviarlo a WhatsApp', 'GET', '/__lab/outbox', undefined, 200, `const current = data.messages.slice(Number(pm.collectionVariables.get('outbox_start'))); const message = current[current.length-1];` + test('Mensaje con batería, coordenadas y seguimiento', `pm.expect(current).to.have.lengthOf(2); pm.expect(message.message).to.include('73%'); pm.expect(message.message).to.include('https://www.google.com/maps?q=0,0'); pm.expect(message.message).to.include(pm.collectionVariables.get('event_first')); pm.expect(message.message).to.include('Método:* BOTON');`));
add('Reintento del mismo evento es idempotente', 'POST', '/alerta', sos('BOTON', '{{event_first}}'), 201, test('No duplica el mismo evento', `pm.expect(data.id).to.eql(Number(pm.collectionVariables.get('alert_first'))); pm.expect(data.duplicada).to.eql(true);`), 'a');
add('Otra alerta mientras hay una activa reutiliza la existente', 'POST', '/alerta', sos(), 201, test('Se mantiene una sola alerta activa', `pm.expect(data.id).to.eql(Number(pm.collectionVariables.get('alert_first'))); pm.expect(data.yaActiva).to.eql(true);`), 'a');
add('Consultar alerta activa', 'GET', '/alerta/activa', undefined, 200, test('La activa corresponde al SOS creado', `pm.expect(data.activa.id).to.eql(Number(pm.collectionVariables.get('alert_first')));`), 'a');
add('Actualizar ubicación del SOS', 'PATCH', '/alerta/{{alert_first}}/ubicacion', { latitud: 0.001, longitud: 0.002 }, 200, test('Coordenadas actualizadas', `pm.expect(Number(data.latitud)).to.eql(0.001); pm.expect(Number(data.longitud)).to.eql(0.002);`), 'a');
add('Seguimiento mediante UUID sin sesión', 'GET', '/alerta/publica/{{event_first}}', undefined, 200, test('Seguimiento refleja ubicación persistida', `pm.expect(data.estado).to.eql('ACTIVA'); pm.expect(Number(data.latitud)).to.eql(0.001); pm.expect(Number(data.longitud)).to.eql(0.002);`));
add('ID numérico sin sesión no permite seguimiento', 'GET', '/alerta/publica/{{alert_first}}', undefined, 404);
add('B no puede modificar ubicación de A', 'PATCH', '/alerta/{{alert_first}}/ubicacion', { latitud: 1, longitud: 1 }, 404, '', 'b');
add('B no puede detener SOS de A', 'POST', '/alerta/{{alert_first}}/detener', {}, 404, '', 'b');
add('B no puede ver SOS ajeno por ID numérico', 'GET', '/alerta/publica/{{alert_first}}', undefined, 404, '', 'b');
add('B no puede modificar contacto de A', 'PATCH', '/contactos-emergencia/{{contact_id}}', { nombre: 'Cambio no autorizado' }, 404, '', 'b');
add('B no puede borrar contacto de A', 'DELETE', '/contactos-emergencia/{{contact_id}}', undefined, 404, '', 'b');
add('B no ve contactos de A', 'GET', '/contactos-emergencia', undefined, 200, test('Aislamiento de cuentas', `pm.expect(data.contactos).to.eql([]);`), 'b');
add('Detener SOS como propietario', 'POST', '/alerta/{{alert_first}}/detener', {}, 200, test('SOS finalizado', `pm.expect(data.estado).to.eql('FINALIZADA');`), 'a');
add('Seguimiento público finalizado oculta coordenadas', 'GET', '/alerta/publica/{{event_first}}', undefined, 200, test('Sin coordenadas públicas después de finalizar', `pm.expect(data.estado).to.eql('FINALIZADA'); pm.expect(data.latitud).to.eql(null); pm.expect(data.longitud).to.eql(null);`));
add('Ya no existe una alerta activa', 'GET', '/alerta/activa', undefined, 200, test('Activa vacía', `pm.expect(data.activa).to.eql(null);`), 'a');
add('Crear SOS de movimiento inmediatamente después', 'POST', '/alerta', sos('MOVIMIENTO'), 201, save('alert_motion', 'data.id') + test('Nueva alerta de movimiento sin bloqueo de 30 segundos', `pm.expect(data.duplicada).to.eql(false); pm.expect(data.origen).to.eql('MOVIMIENTO'); pm.expect(data.id).not.to.eql(Number(pm.collectionVariables.get('alert_first')));`), 'a');
add('Finalizar SOS de movimiento', 'POST', '/alerta/{{alert_motion}}/detener', {}, 200, test('Movimiento finalizado', `pm.expect(data.estado).to.eql('FINALIZADA');`), 'a');
add('Crear SOS de volumen sin lectura de batería', 'POST', '/alerta', { origen: 'VOLUMEN', eventoId: '{{$guid}}', latitud: 0, longitud: 0 }, 201, save('alert_volume', 'data.id') + test('SOS de volumen creado', `pm.expect(data.origen).to.eql('VOLUMEN'); pm.expect(data.duplicada).to.eql(false);`), 'a');
add('Validar ausencia de duplicados y batería opcional', 'GET', '/__lab/outbox', undefined, 200, `const current = data.messages.slice(Number(pm.collectionVariables.get('outbox_start')));` + test('Una invitación y tres SOS simulados', `pm.expect(current).to.have.lengthOf(4); pm.expect(current[3].message).to.include('No disponible'); pm.expect(current[3].message).to.include('Método:* VOLUMEN');`));
add('Finalizar SOS de volumen', 'POST', '/alerta/{{alert_volume}}/detener', {}, 200, test('Volumen finalizado', `pm.expect(data.estado).to.eql('FINALIZADA');`), 'a');
add('Historial conserva los tres SOS finalizados', 'GET', '/alerta/historial', undefined, 200, test('Historial completo y consistente', `pm.expect(data).to.have.lengthOf(3); pm.expect(data.every(a => a.estado === 'FINALIZADA')).to.eql(true); pm.expect(data.map(a => a.id)).to.include(Number(pm.collectionVariables.get('alert_first')));`), 'a');
add('Desactivar notificaciones del contacto', 'PATCH', '/contactos-emergencia/{{contact_id}}', { nombre: 'Contacto editado', notificarActivo: false }, 200, test('Edición guardada', `pm.expect(data.contacto.nombre).to.eql('Contacto editado'); pm.expect(data.contacto.notificarActivo).to.eql(false);`), 'a');
add('Crear SOS con contacto desactivado', 'POST', '/alerta', sos(), 201, save('alert_muted', 'data.id') + test('El SOS se registra igualmente', `pm.expect(data.duplicada).to.eql(false);`), 'a');
add('No se notifica al contacto desactivado', 'GET', '/__lab/outbox', undefined, 200, test('El receptor simulado no recibió mensajes nuevos', `pm.expect(data.messages.length - Number(pm.collectionVariables.get('outbox_start'))).to.eql(4);`));
add('Finalizar último SOS', 'POST', '/alerta/{{alert_muted}}/detener', {}, 200, test('Último SOS finalizado', `pm.expect(data.estado).to.eql('FINALIZADA');`), 'a');
add('Eliminar contacto sintético', 'DELETE', '/contactos-emergencia/{{contact_id}}', undefined, 200, '', 'a');
add('Comprobar eliminación persistida', 'GET', '/contactos-emergencia', undefined, 200, test('Lista vacía después de eliminar', `pm.expect(data.contactos).to.eql([]);`), 'a');
add('Cerrar sesión A', 'POST', '/auth/logout', {}, 204, test('El servidor indica borrar la cookie', `pm.expect(pm.response.headers.get('Set-Cookie')).to.include('Expires=Thu, 01 Jan 1970');`), 'a');
add('Perfil sin cookie vuelve a rechazarse', 'GET', '/auth/me', undefined, 401);
const collection = { info: { name: 'SafeAlert · Integración local · Postman', description: 'Pruebas HTTP secuenciales de integración sobre NestJS y PGlite. Green API simulado en localhost; sin mensajes reales. Las cuentas son únicas por ejecución. No mide sensores Android, Neon, Cloud Run ni entrega real de WhatsApp. Ejecutar la colección completa en orden, una iteración. Cookies automáticas desactivadas para aislar A/B; cookie de sesión explícita por solicitud. Cierre de sesión verifica borrado de cookie, no revocación del JWT.', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: requests, variable: [], auth: { type: 'noauth' } };
fs.writeFileSync(path.join(__dirname, 'SafeAlert-integracion.postman_collection.json'), JSON.stringify(collection, null, 2));
console.log('Colección generada: ' + requests.length + ' peticiones.');
