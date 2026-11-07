declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';

  // react-native-svg-transformer (metro.config.js) compiles an imported .svg into a component.
  const content: FC<SvgProps>;
  export default content;
}
