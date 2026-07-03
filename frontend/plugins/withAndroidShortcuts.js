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

    // translatable 미지정(=번역 가능) — values-ja/zh-rTW/zh-rHK 로케일 오버라이드와 충돌 방지
    const addStringIfMissing = (name, value) => {
      if (!strings.find((s) => s.$?.name === name)) {
        strings.push({ $: { name }, _: value });
      }
    };

    addStringIfMissing('shortcut_voice_short_label', '음성 기록');
    addStringIfMissing('shortcut_voice_long_label', '음성으로 기록하기');

    modConfig.modResults.resources.string = strings;
    return modConfig;
  });

  // Step 2.5: 정적 단축키 레이블의 로케일별 번역 리소스 생성 (기기 언어 기준으로 Android가 자동 선택)
  //   - 일본어(values-ja), 번체중국어 대만(values-zh-rTW)·홍콩(values-zh-rHK)
  //   - MissingTranslation 빌드오류 방지 위해 tools:ignore 사용(해당 파일엔 단축 레이블만 둠)
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resRoot = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res',
      );
      const LOCALES = {
        'values-ja': { short: '音声記録', long: '音声で記録する' },
        'values-zh-rTW': { short: '語音記錄', long: '用語音記錄' },
        'values-zh-rHK': { short: '語音記錄', long: '用語音記錄' },
      };
      for (const [dir, v] of Object.entries(LOCALES)) {
        const localeDir = path.join(resRoot, dir);
        fs.mkdirSync(localeDir, { recursive: true });
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools" tools:ignore="MissingTranslation">
    <string name="shortcut_voice_short_label">${v.short}</string>
    <string name="shortcut_voice_long_label">${v.long}</string>
</resources>
`;
        fs.writeFileSync(path.join(localeDir, 'strings.xml'), xml, 'utf8');
      }
      return modConfig;
    },
  ]);

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
