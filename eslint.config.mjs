import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextCoreWebVitals,
  {
    name: 'fintrack/generated-build-artifacts',
    ignores: ['**/.next.prebuild-recovery/**'],
  },
  {
    name: 'fintrack/preserve-existing-react-hooks-gate',
    rules: {
      // Next 14's recommended preset enabled rules-of-hooks and exhaustive-deps.
      // Keep that gate unchanged; do not opt into newly added compiler rules here.
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },
]

export default config
