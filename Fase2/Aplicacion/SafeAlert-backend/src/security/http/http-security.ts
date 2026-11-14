import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { CONFIRMACION_ESTILOS } from '../../contactos-emergencia/confirmacion.styles';

const styleHash = createHash('sha256').update(CONFIRMACION_ESTILOS).digest('base64');
export const API_CONTENT_SECURITY_POLICY = [
  "default-src 'none'", "base-uri 'none'", "object-src 'none'",
  "frame-ancestors 'none'", "form-action 'self'", "script-src 'none'",
  "style-src 'sha256-" + styleHash + "'", "style-src-attr 'none'",
].join('; ') + ';';

export function configureHttpSecurity(app: INestApplication): void {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', API_CONTENT_SECURITY_POLICY);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
}
