// ESLint = automatic style/bug checker. Run: npm run lint
const commonRules = {
  'no-unused-vars': 'warn',
  'no-undef': 'error',
  eqeqeq: 'error',
  'no-var': 'error',
  'prefer-const': 'warn'
};

const nodeGlobals = {
  require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly',
  __dirname: 'readonly', Buffer: 'readonly', setInterval: 'readonly', fetch: 'readonly'
};

const jestGlobals = {
  describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly',
  beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly'
};

const browserGlobals = {
  window: 'readonly', document: 'readonly', fetch: 'readonly', sessionStorage: 'readonly',
  confirm: 'readonly', alert: 'readonly', setTimeout: 'readonly', console: 'readonly',
  Blob: 'readonly', URL: 'readonly',
  App: 'writable', DashboardModule: 'writable', CatalogModule: 'writable', InventoryModule: 'writable',
  DispatchModule: 'writable', DistributorModule: 'writable', AlertsModule: 'writable'
};

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'docs/api/**'] },
  {
    files: ['**/*.js'],
    ignores: ['public/**', 'tests/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: nodeGlobals },
    rules: commonRules
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...nodeGlobals, ...jestGlobals } },
    rules: commonRules
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browserGlobals },
    rules: { ...commonRules, 'no-unused-vars': 'off' } // modules are used from index.html onclick attributes
  }
];
