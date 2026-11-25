// Genera un plan estándar JMeter, sin plugins ni dependencias adicionales.
const fs = require('node:fs');
const path = require('node:path');
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const prop = (name, value, type = 'string') => `<${type}Prop name="${name}">${xml(value)}</${type}Prop>`;
const pair = (element, children = '') => element + '<hashTree>' + children + '</hashTree>';
const script = (type, name, code) => pair(`<${type} guiclass="TestBeanGUI" testclass="${type}" testname="${xml(name)}" enabled="true">${prop('scriptLanguage', 'groovy')}${prop('cacheKey', 'true')}${prop('script', code)}</${type}>`);
const assertion = code => script('JSR223Assertion', 'Validar respuesta y datos', `if (prev.isSuccessful()) { try { def data = new groovy.json.JsonSlurper().parseText(prev.getResponseDataAsString()); ${code} } catch (Exception ex) { AssertionResult.setFailure(true); AssertionResult.setFailureMessage(ex.toString()) } }`);
function http(label, method, url, body, check, status = 200) {
  const args = body === undefined ? '<elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments"/></elementProp>' : `<elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments"><elementProp name="" elementType="HTTPArgument">${prop('HTTPArgument.always_encode', false, 'bool')}${prop('Argument.value', body)}${prop('Argument.metadata', '=')}</elementProp></collectionProp></elementProp>`;
  return pair(`<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${xml(label)}" enabled="true">${args}${prop('HTTPSampler.domain', '127.0.0.1')}${prop('HTTPSampler.port', '4400')}${prop('HTTPSampler.protocol', 'http')}${prop('HTTPSampler.path', url)}${prop('HTTPSampler.method', method)}${prop('HTTPSampler.follow_redirects', false, 'bool')}${prop('HTTPSampler.auto_redirects', false, 'bool')}${prop('HTTPSampler.use_keepalive', true, 'bool')}${prop('HTTPSampler.postBodyRaw', true, 'bool')}${prop('HTTPSampler.connect_timeout', '5000')}${prop('HTTPSampler.response_timeout', '10000')}</HTTPSamplerProxy>`, assertion(`assert prev.getResponseCode() == '${status}'; ${check || ''}`));
}
function thread(name, setup, children) {
  const type = setup ? 'SetupThreadGroup' : 'ThreadGroup';
  return pair(`<${type} guiclass="${setup ? 'SetupThreadGroupGui' : 'ThreadGroupGui'}" testclass="${type}" testname="${name}" enabled="true">${prop('ThreadGroup.on_sample_error', 'stopthread')}<elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" enabled="true">${prop('LoopController.continue_forever', false, 'bool')}${prop('LoopController.loops', setup ? '1' : '-1')}</elementProp>${prop('ThreadGroup.num_threads', setup ? '1' : '${__P(users,5)}')}${prop('ThreadGroup.ramp_time', setup ? '1' : '${__P(ramp,5)}')}${prop('ThreadGroup.scheduler', !setup, 'bool')}${prop('ThreadGroup.duration', setup ? '' : '${__P(duration,45)}')}${prop('ThreadGroup.delay', '0')}</${type}>`, children);
}
const guard = script('JSR223Sampler', 'SETUP - Verificar laboratorio aislado', `
try {
  assert props.getProperty('users','5').toInteger() in 1..50
  assert props.getProperty('duration','45').toInteger() in 1..180
  def connection = new URL('http://127.0.0.1:4400/__lab/status').openConnection()
  connection.setConnectTimeout(3000); connection.setReadTimeout(3000)
  def lab = new groovy.json.JsonSlurper().parseText(connection.getInputStream().getText('UTF-8'))
  assert lab.profile == 'jmeter' && lab.externalMessagingEnabled == false && lab.externalFetchBlocked == true
  SampleResult.setResponseCode('200'); SampleResult.setSuccessful(true)
} catch (Throwable ex) { SampleResult.setSuccessful(false); SampleResult.setResponseCode('500'); SampleResult.setResponseMessage(ex.toString()); ctx.getEngine().stopTest(true) }
`);
const once = pair('<OnceOnlyController guiclass="OnceOnlyControllerGui" testclass="OnceOnlyController" testname="Sesión por usuario" enabled="true"/>',
  http('SETUP - Iniciar sesión', 'POST', '/auth/login', '{"email":"jmeter.${__threadNum}@example.invalid","password":"SafeAlert-JMeter-2026!"}', `assert data.usuario.email == 'jmeter.' + ctx.getThreadNum().plus(1) + '@example.invalid'`) +
  http('SETUP - Consultar alerta pendiente', 'GET', '/alerta/activa', undefined, `vars.put('pending', data.activa?.id?.toString() ?: 'NONE')`) +
  pair(`<IfController guiclass="IfControllerPanel" testclass="IfController" testname="Limpiar alerta del escenario anterior" enabled="true">${prop('IfController.condition', "${__groovy(vars.get('pending') != 'NONE')}")}${prop('IfController.evaluateAll', false, 'bool')}${prop('IfController.useExpression', true, 'bool')}</IfController>`, http('SETUP - Finalizar pendiente', 'POST', '/alerta/${pending}/detener', '{}', `assert data.estado == 'FINALIZADA'`)));
const flow = once +
  http('CARGA - Perfil', 'GET', '/auth/me', undefined, `assert data.usuario.email == 'jmeter.' + ctx.getThreadNum().plus(1) + '@example.invalid'`) +
  http('CARGA - Contactos', 'GET', '/contactos-emergencia', undefined, 'assert data.contactos.size() == 1') +
  http('CARGA - Crear SOS', 'POST', '/alerta', '{"origen":"BOTON","eventoId":"${__UUID()}","latitud":0,"longitud":0,"bateriaPorcentaje":50}', `assert data.id > 0; assert data.eventoId; assert !data.yaActiva; assert !data.duplicada; vars.put('alert_id', data.id.toString()); vars.put('event_id', data.eventoId.toString())`, 201) +
  http('CARGA - Actualizar ubicación', 'PATCH', '/alerta/${alert_id}/ubicacion', '{"latitud":0.001,"longitud":0.001}', 'assert data != null') +
  http('CARGA - Seguimiento', 'GET', '/alerta/publica/${event_id}', undefined, `assert data.estado == 'ACTIVA'`) +
  http('CARGA - Finalizar SOS', 'POST', '/alerta/${alert_id}/detener', '{}', `assert data.estado == 'FINALIZADA'`) +
  http('CARGA - Historial', 'GET', '/alerta/historial', undefined, 'assert data instanceof List; assert data.size() > 0');
const configs = pair(`<CookieManager guiclass="CookiePanel" testclass="CookieManager" testname="Cookies separadas por usuario" enabled="true"><collectionProp name="CookieManager.cookies"/>${prop('CookieManager.clearEachIteration', false, 'bool')}${prop('CookieManager.controlledByThreadGroup', false, 'bool')}</CookieManager>`) + pair(`<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="JSON" enabled="true"><collectionProp name="HeaderManager.headers"><elementProp name="" elementType="Header">${prop('Header.name', 'Content-Type')}${prop('Header.value', 'application/json')}</elementProp></collectionProp></HeaderManager>`);
const timer = pair(`<ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="Pausa entre peticiones" enabled="true">${prop('ConstantTimer.delay', '${__P(think_ms,200)}')}</ConstantTimer>`);
const plan = `<?xml version="1.0" encoding="UTF-8"?><jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3"><hashTree>${pair('<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="SafeAlert - Carga local aislada" enabled="true"><boolProp name="TestPlan.serialize_threadgroups">false</boolProp><elementProp name="TestPlan.user_defined_variables" elementType="Arguments"><collectionProp name="Arguments.arguments"/></elementProp></TestPlan>', configs + thread('Comprobar aislamiento', true, guard) + thread('Usuarios SafeAlert', false, timer + flow))}</hashTree></jmeterTestPlan>`;
fs.writeFileSync(path.join(__dirname, 'SafeAlert-carga-local.jmx'), plan);
console.log('Plan JMeter generado. Destino fijo: http://127.0.0.1:4400');
