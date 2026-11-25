// Comparte el laboratorio aislado, con puertos y usuarios exclusivos para JMeter.
process.env.SAFEALERT_LAB_PROFILE = 'jmeter';
require('../zap/start-local.cjs');
