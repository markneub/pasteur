import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  // Relax rules for generated shadcn-vue component files
  {
    files: ['src/components/ui/**/*.vue', 'src/components/ui/**/*.js'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        global: 'writable',
      },
    },
  },
]
