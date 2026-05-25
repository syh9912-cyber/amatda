/**
 * Expo SDK 54 babel config with reanimated 4.x / worklets plugin.
 * react-native-worklets/plugin 은 reanimated 4 + worklets 사용 시 필수.
 * 미적용 시 metro bundler 가 async/class expression 등을 transpile 못 해
 * hermesc 단계에서 "async functions are unsupported" 에러 발생.
 *
 * babel-preset-expo 는 expo nested 패키지 사용 (top-level 안 깔려 있어 require.resolve 로 명시).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [require.resolve('expo/node_modules/babel-preset-expo')],
    plugins: [
      // async => generator + async generator 명시 transpile. Hermes 가 async
      // 를 native 로 지원하지 않는 RN 0.81 환경에서 필수.
      '@babel/plugin-transform-async-to-generator',
      '@babel/plugin-transform-async-generator-functions',
      // reanimated 4.x + worklets 는 마지막에 위치해야 함 (공식 권장)
      'react-native-worklets/plugin',
    ],
  };
};
