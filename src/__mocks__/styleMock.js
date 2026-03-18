// Returns the CSS class name key as a plain string rather than undefined.
// Example: styles.card === 'card'  (deterministic, non-empty, no real CSS needed in tests).
//
// The compiled TypeScript wraps default imports with tslib's __importDefault helper:
//   const mod = __importDefault(require('./Foo.module.scss'));
//   className={mod.default.card}    // 'card'
// __importDefault checks mod.__esModule: if truthy it skips wrapping.
// A plain Proxy would return '__esModule' (a truthy string) causing __importDefault
// to skip wrapping, so mod.default would resolve to the string 'default' instead
// of the class-name proxy. Fix: export a proper ES-module-shaped object.
const classProxy = new Proxy(
  {},
  {
    get: function (_target, prop) {
      if (typeof prop === 'string') return prop;
      return undefined;
    },
  }
);
module.exports = { __esModule: true, default: classProxy };
