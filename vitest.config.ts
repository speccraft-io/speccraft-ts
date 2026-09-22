import ts from 'typescript';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'stage3-decorators',
      enforce: 'pre',
      transform(code: string, id: string): { code: string; map: string | undefined } | null {
        if (!id.endsWith('.ts') || !/^\s*@[\w.]+/m.test(code)) {
          return null;
        }
        const output = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, sourceMap: true },
        });
        return { code: output.outputText, map: output.sourceMapText };
      },
    },
  ],
});
