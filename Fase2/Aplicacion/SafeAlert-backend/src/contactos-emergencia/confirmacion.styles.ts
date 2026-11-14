// CSS fijo de la página de confirmación. Su hash autoriza únicamente este bloque.
export const CONFIRMACION_ESTILOS = `
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; background: #f4f7f5; color: #173844; }
    .card { max-width: 440px; width: 100%; background: #ffffff; border: 1px solid #dce6e1; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(23, 63, 73, 0.08); }
    .banner { background: #173f49; color: #ffffff; padding: 24px 26px; }
    .eyebrow { font-size: 10px; letter-spacing: 1.6px; color: #a8d0c7; font-weight: 700; display: block; margin-bottom: 6px; }
    .banner h1 { margin: 0; font-size: 20px; line-height: 1.3; }
    .content { padding: 26px; display: grid; gap: 12px; }
    .content p { margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #4c6870; }
    .btn { width: 100%; border: 0; background: #246d60; color: #ffffff; padding: 14px 18px; border-radius: 11px; font-size: 14px; font-weight: 650; cursor: pointer; }
    .btn:hover { background: #205b51; }
    .btn-reject { width: 100%; border: 1px solid #efd9d5; background: #fff4f2; color: #9c3b4b; padding: 12px 18px; border-radius: 11px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .badge-ok { display: inline-block; padding: 10px 14px; border-radius: 9px; background: #eaf4ed; color: #246d60; font-size: 12px; font-weight: 650; text-align: center; }
  `;
