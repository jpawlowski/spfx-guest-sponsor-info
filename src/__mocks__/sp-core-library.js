// Minimal shim for @microsoft/sp-core-library.
// The real package accesses browser globals (window, document) at module load time,
// which makes it incompatible with the jest Node bootstrap phase even when
// jest-environment-jsdom is used. This shim provides only the subset needed by our
// components: DisplayMode (enum) and Version (parse helper).
module.exports = {
  DisplayMode: {
    Read: 1,
    Edit: 2,
  },
  Version: {
    parse: function (v) {
      return { toString: function () { return String(v); } };
    },
  },
};
