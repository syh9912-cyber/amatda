// app.json을 기반으로 하면서 environment variable에서
// google-services.json 경로를 주입하기 위한 dynamic config.
// Expo는 app.config.js가 있으면 이 파일을 우선 사용하고,
// config 파라미터로 app.json 내용을 받아올 수 있다.
module.exports = ({ config }) => {
  const androidConfig = { ...(config.android || {}) };

  if (process.env.GOOGLE_SERVICES_JSON) {
    androidConfig.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  } else {
    // 로컬 개발: frontend/google-services.json 이 존재하면 그것을 사용
    androidConfig.googleServicesFile = './google-services.json';
  }

  return {
    ...config,
    android: androidConfig,
  };
};
