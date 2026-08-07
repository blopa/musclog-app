// Manual mock for `react-native-svg`. Its Fabric components import
// `react-native/Libraries/Utilities/codegenNativeComponent`, a deep path that reaches the
// real React Native package and its missing native bridge. `lucide-react-native` pulls
// this in for every icon, so any module that imports an icon would otherwise take a whole
// suite down at import time.
//
// Every export is a plain component that renders nothing — enough for icons to be
// referenced and rendered without asserting on their SVG output.

const React = require('react');

const svgComponent = (displayName) => {
  const Component = ({ children }) => React.createElement(React.Fragment, null, children);
  Component.displayName = displayName;
  return Component;
};

const ELEMENTS = [
  'Circle',
  'ClipPath',
  'Defs',
  'Ellipse',
  'ForeignObject',
  'G',
  'Image',
  'Line',
  'LinearGradient',
  'Marker',
  'Mask',
  'Path',
  'Pattern',
  'Polygon',
  'Polyline',
  'RadialGradient',
  'Rect',
  'Stop',
  'Svg',
  'Symbol',
  'Text',
  'TextPath',
  'TSpan',
  'Use',
];

const mock = { __esModule: true };
for (const name of ELEMENTS) {
  mock[name] = svgComponent(name);
}
mock.default = mock.Svg;
mock.SvgXml = svgComponent('SvgXml');
mock.SvgUri = svgComponent('SvgUri');

module.exports = mock;
