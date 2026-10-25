import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'artifacts/**', 'ip-remediation/**', 'private/**', 'out/**'],
  },
  {
    // Preserve the existing React 18 lint contract during the security upgrade.
    // React Compiler is not enabled; arcade engines intentionally use mutable
    // refs. Keep rules-of-hooks and exhaustive-deps from nextVitals enabled.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
