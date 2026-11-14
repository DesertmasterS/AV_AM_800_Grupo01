import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { API_CONTENT_SECURITY_POLICY, configureHttpSecurity } from './http-security';
import { CONFIRMACION_ESTILOS } from '../../contactos-emergencia/confirmacion.styles';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

describe('Cabeceras de seguridad HTTP', () => {
  it('autoriza el CSS fijo por hash y prohíbe scripts, marcos e inline no autorizado', () => {
    const expected = createHash('sha256').update(CONFIRMACION_ESTILOS).digest('base64');
    expect(API_CONTENT_SECURITY_POLICY).toContain("style-src 'sha256-" + expected + "'");
    expect(API_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(API_CONTENT_SECURITY_POLICY).toContain("script-src 'none'");
    expect(API_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
  });
  it('protege también respuestas de error y desactiva X-Powered-By', () => {
    const disable = vi.fn();
    let middleware: (req: Request, res: Response, next: NextFunction) => void;
    const app = { getHttpAdapter: () => ({ getInstance: () => ({ disable }) }), use: (handler: typeof middleware) => { middleware = handler; } };
    configureHttpSecurity(app as unknown as INestApplication);
    const setHeader = vi.fn(), next = vi.fn();
    middleware!({} as Request, { setHeader } as unknown as Response, next);
    expect(disable).toHaveBeenCalledWith('x-powered-by');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
