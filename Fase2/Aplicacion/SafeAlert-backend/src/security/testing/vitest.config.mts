import { defineConfig } from 'vitest/config';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// Nest necesita los mismos decoradores y metadatos de tipos que emite el build de TypeScript.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  plugins: [{
    name: 'nest-typescript-metadata',
    enforce: 'pre',
    transform(source, id) {
      const filename = id.split('?')[0].replaceAll('\\', '/');
      if (!filename.endsWith('.ts') || filename.includes('/node_modules/')) return;
      const result = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: {
          target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext,
          experimentalDecorators: true, emitDecoratorMetadata: true,
          esModuleInterop: true, sourceMap: true, inlineSources: true,
        },
      });
      return { code: result.outputText, map: result.sourceMapText ?? null };
    },
  }],
  test: {
    environment: 'node', globals: true,
    setupFiles: ['src/security/testing/setup.ts'],
    include: mode === 'e2e' ? ['test/**/*.e2e-spec.ts'] : ['src/**/*.spec.ts'],
    coverage: { provider: 'v8', reportsDirectory: 'coverage', include: ['src/**/*.ts'], exclude: ['src/**/*.spec.ts', 'src/security/testing/**'] },
  },
}));
