# Identidad SafeAlert

Diseño aprobado: primera propuesta del 22 de noviembre de 2026, escudo azul/verde
con una S blanca y tres señales de alerta coral.

- `safealert-logo-approved.png`: propuesta aprobada con nombre, sin modificaciones.
- `safealert-symbol.png`: símbolo preparado con la herramienta integrada `image_gen`,
  conservando escudo, S y señales, retirando nombre y fondo exterior.
- `safealert-icon-512.png`: exportación cuadrada sobre blanco para distribución.

El nuevo diseño se utiliza como icono Android, en las carpetas
`android/app/src/main/res/mipmap-*`, y sustituye el escudo con check de la esquina
superior de la navegación móvil y de escritorio. El símbolo web está en
`src/assets/branding/safealert-symbol.png`. Acceso, registro, favicon y pantallas
de inicio conservan su apariencia anterior. El logo completo se mantiene solo como
fuente de diseño, sin añadirlo a otras vistas. El nombre visible es `SafeAlert`.

Para regenerar resoluciones en Windows desde el frontend:

```powershell
pwsh -File scripts/generate-brand-assets.ps1
npm run build
npx cap sync android
```

El exportador utiliza System.Drawing de Windows, sin añadir dependencias npm.
Mantiene el alfa y las proporciones del símbolo. Genera iconos normales, redondos
y capas adaptativas a cinco densidades; mantiene un margen para máscaras de Android.
Solo exporta el símbolo de la marca superior; no modifica el favicon ni SplashScreen.

Prompt utilizado para preparar el símbolo (herramienta integrada, fondo transparente):

> Edit the provided approved SafeAlert logo. Extract ONLY the exact existing shield symbol with the white S-shaped negative space and the three coral alarm rays. REMOVE the entire SafeAlert wordmark below the shield. REMOVE the white background to actual transparent alpha outside the symbol, and preserve the white S INSIDE the shield as opaque white. Preserve the exact shield contour, navy and teal fills, subtle original color shading, coral rays, original proportions and relative positions. Do not redesign, stylize or invent details. No lettering whatsoever. Center the complete shield and rays together as a balanced standalone mark on a square transparent canvas with a small even safety margin, about 8% on all sides. High-quality clean edges, no added border, no shadows, no mockup. This is the same approved brand symbol prepared for an Android application icon.

Referencia de exportación Android: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
