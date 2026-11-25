// Receptor HTTP simulado. Solo se registra en el laboratorio aislado, nunca en AppModule.
const { randomUUID } = require('node:crypto');
exports.attach = (app, express) => {
  const messages = [];
  // Nest detecta cualquier middleware jsonParser ya registrado y omite el suyo.
  // Registrarlo globalmente evita dejar las demás rutas sin lector de JSON.
  app.use(express.json());
  app.use('/__lab/outbox', (_req, res) => res.json({ simulated: true, messages }));
  app.use('/__lab/green-api/waInstancelocal-postman/sendMessage/local-only', (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'POST requerido' });
    if (!/^5690000\d{4}@c\.us$/.test(req.body?.chatId || '') || typeof req.body?.message !== 'string') {
      return res.status(400).json({ message: 'Solo destinatarios sintéticos del laboratorio' });
    }
    const idMessage = 'simulated-' + randomUUID();
    messages.push({ idMessage, chatId: req.body.chatId, message: req.body.message, at: new Date().toISOString() });
    return res.json({ idMessage });
  });
};
