// Minimal shim for @microsoft/sp-http used in Jest tests.
// The real package loads FetchProvider which calls ServiceKey.create() at module
// evaluation time — a browser-only call that fails in the Jest Node environment.
// This shim provides only the subset used by our services:
//   - MSGraphClientV3  (used only as a TypeScript type; erased in compiled JS)
//   - AadHttpClient    (AadHttpClient.configurations.v1 used as a value in getSponsorsViaProxy)
module.exports = {
  MSGraphClientV3: {},
  AadHttpClient: {
    configurations: {
      v1: {},
    },
  },
};
