// Minimal no-op webpack loader for non-web targets (node / webworker).
// Returns an empty ES module so that CSS, SCSS, PNG, SVG etc. imports
// that come transitively from @kaoto/kaoto do not break the node/webworker bundle.
module.exports = function nullLoader() {
  return 'module.exports = {};';
};
