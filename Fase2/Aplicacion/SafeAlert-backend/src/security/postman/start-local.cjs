// PGlite usa UTC. Alinear el proceso evita reinterpretar timestamp sin zona como hora chilena.
process.env.TZ = 'UTC';
process.env.SAFEALERT_LAB_PROFILE = 'postman';
require('../zap/start-local.cjs');
