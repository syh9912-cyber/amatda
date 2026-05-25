/**
 * withAndroidShortcuts.js
 *
 * Expo config plugin:
 * 1) shortcuts.xml 파일 생성 → android/app/src/main/res/xml/shortcuts.xml
 *    - shortcutShortLabel / shortcutLongLabel 은 @string/ 참조 필수 (AAPT 요구사항)
 * 2) strings.xml 에 shortcut 레이블 문자열 리소스 추가
 * 3) AndroidManifest.xml MainActivity 에 <meta-data android:name="android.app.shortcuts"> 추가
 *
 * 제공 기능:
 * - 앱 아이콘 길게 누르기 → "음성으로 기록하기" 바로가기 → amatda://voice
 * - Google App Actions: "OK Google, 아맞다 음성 기록해줘" → amatda://voice
 */

const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// shortcutShortLabel/shortcutLongLabel 은 @string/ 참조여야 AAPT 통과
const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">

    <!--
        정적 앱 바로가기 (Static App Shortcut)
        아이콘 길게 누르기 → "음성으로 기록하기" 탭 → amatda://voice 오픈
        → voice.tsx 화면: 음성 인식 자동 시작
    -->
    <shortcut
        android:shortcutId="voice_record"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_voice_short_label"
        android:shortcutLongLabel="@string/shortcut_voice_long_label">
        <intent
            android:action="android.intent.action.VIEW"
            android:data="amatda://voice" />
    </shortcut>

    <!--
        Google App Actions 기능 선언 (OPEN_APP_FEATURE Built-in Intent)
        "OK Google, 아맞다 음성 기록해줘" → amatda://voice 오픈
    -->
    <capability android:name="actions.intent.OPEN_APP_FEATURE">
        <intent
            android:action="android.intent.action.VIEW"
            android:data="amatda://voice" />
    </capability>

</shortcuts>
`;

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withAndroidShortcuts(config) {
  // Step 1: shortcuts.xml 파일 생성
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), SHORTCUTS_XML, 'utf8');
      return modConfig;
    },
  ]);

  // Step 2: strings.xml 에 shortcut 레이블 추가 (AAPT @string/ 참조 요구사항)
  config = withStringsXml(config, (modConfig) => {
    const strings = modConfig.modResults.resources.string ?? [];

    const addStringIfMissing = (name, value) => {
      if (!strings.find((s) => s.$?.name === name)) {
        strings.push({ $: { name, translatable: 'false' }, _: value });
      }
    };

    addStringIfMissing('shortcut_voice_short_label', '음성 기록');
    addStringIfMissing('shortcut_voice_long_label', '음성으로 기록하기');

    modConfig.modResults.resources.string = strings;
    return modConfig;
  });

  // Step 3: AndroidManifest.xml - MainActivity 에 meta-data 추가
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return modConfig;

    const mainActivity = application.activity?.find((a) => {
      const name = a.$?.['android:name'] ?? '';
      return name === '.MainActivity' || name.endsWith('.MainActivity');
    });

    if (!mainActivity) return modConfig;

    if (!mainActivity['meta-data']) {
      mainActivity['meta-data'] = [];
    }

    const alreadyAdded = mainActivity['meta-data'].some(
      (m) => m.$?.['android:name'] === 'android.app.shortcuts',
    );

    if (!alreadyAdded) {
      mainActivity['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/shortcuts',
        },
      });
    }

    return modConfig;
  });

  return config;
}

module.exports = withAndroidShortcuts;
