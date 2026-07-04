/**
 * withIosSiriShortcut.js
 *
 * iOS App Intents(앱 내장 시리 명령) 추가 — "시리야, 아맞다 육아" → 음성 기록 화면 자동 열기 + 녹음 시작.
 * (Apple 규칙상 문구에 앱 이름 필수 + 앱이름 단독은 "앱 열기"와 충돌 → "아맞다 육아"처럼 동작어를 붙임)
 *
 * 동작:
 *   1) prebuild 시 ios/<project>/AmatdaSiriShortcut.swift 생성
 *   2) Xcode 프로젝트 메인 타깃 빌드 소스에 추가
 *   3) 일본어/번체중국어 Siri 문구·제목 현지화(.lproj/*.strings) 생성 + Xcode 등록
 *
 * 다국어(현지화) 원리:
 *   - Siri 음성 호출 문구는 반드시 앱 표시이름(\(.applicationName))을 포함해야 함(Apple 규칙).
 *     앱 표시이름은 app.json 의 `locales`(CFBundleDisplayName)로 언어별 현지화됨:
 *       ko=아맞다 / ja=なるほど育児 / zh-Hant=育兒答
 *   - 음성 호출 문구는 Apple 규정상 파일명 AppShortcuts.strings 로만 현지화 가능.
 *     key = Swift 기본(한국어) 문구( ${applicationName} 토큰 유지 ), value = 해당 언어 문구.
 *   - 제목/설명/shortTitle 은 LocalizedStringResource → Localizable.strings 로 현지화.
 *   - Siri 가 듣는 언어 = 기기 Siri 언어. 각 언어 .lproj 가 있어야 그 언어로 호출 가능.
 *
 * Swift(App Intents, iOS 16+):
 *   - AmatdaVoiceRecordIntent.perform → openAppWhenRun(앱 전면) + NSUserDefaults 플래그 기록
 *     → RN(react-native Settings)이 플래그 감지 → /voice 이동 → 텍스트 없는 진입(Case 2) → 음성 인식 자동 시작
 *     (OpenURLIntent 은 커스텀 스킴 실행 차단되어 미사용)
 *   - AmatdaAppShortcuts: "아맞다 육아", "아맞다 기록", "아맞다 음성 기록" 문구 등록
 *     (Apple 규칙상 문구에 앱 이름 \(.applicationName) 필수)
 *
 * ※ 네이티브 변경이라 OTA 불가 — 새 빌드부터 적용. deploymentTarget 16.0 필요(이미 설정됨).
 * ※ 실제 Siri 음성 호출은 실기기(일본어/중국어 Siri 설정)에서만 최종 검증 가능.
 */
const {
  withDangerousMod,
  withXcodeProject,
  withInfoPlist,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const { addResourceFileToGroup, ensureGroupRecursively } = IOSConfig.XcodeUtils;

const SWIFT_FILE = 'AmatdaSiriShortcut.swift';

const SWIFT_CONTENTS = `// 자동 생성 (plugins/withIosSiriShortcut.js) — 직접 수정 금지.
import AppIntents
import Foundation

@available(iOS 16.0, *)
struct AmatdaVoiceRecordIntent: AppIntent {
    static var title: LocalizedStringResource = "음성으로 육아 기록"
    static var description = IntentDescription("아맞다 음성 기록 화면을 열고 바로 녹음을 시작합니다.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        // OpenURLIntent 은 커스텀 스킴(amatda://) 실행이 시리/단축어 컨텍스트에서 차단됨
        // → openAppWhenRun 으로 앱만 전면에 띄우고, NSUserDefaults 에 플래그 기록.
        // RN(react-native Settings)에서 이 플래그를 읽어 /voice 로 이동 + 녹음 시작.
        UserDefaults.standard.set(true, forKey: "amatda_siri_voice_pending")
        UserDefaults.standard.synchronize()
        return .result()
    }
}

@available(iOS 16.0, *)
struct AmatdaAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AmatdaVoiceRecordIntent(),
            phrases: [
                "\\(.applicationName) 육아",
                "\\(.applicationName) 기록",
                "\\(.applicationName) 음성 기록",
                "\\(.applicationName) 음성"
            ],
            shortTitle: "음성 기록",
            systemImageName: "mic.fill"
        )
    }
}
`;

/**
 * 언어별 Siri 문구/제목 현지화 사전.
 * - appShortcuts: key = Swift 기본(한국어) 음성 문구. ${applicationName} 토큰은 그대로 둔다
 *   (앱 표시이름이 언어별로 치환됨).
 * - localizable: key = Swift 기본(한국어) title/description/shortTitle 문자열.
 */
const SIRI_LOCALIZATIONS = {
  ja: {
    appShortcuts: {
      '${applicationName} 육아': '${applicationName}で記録',
      '${applicationName} 기록': '${applicationName}に記録',
      '${applicationName} 음성 기록': '${applicationName}で音声記録',
      '${applicationName} 음성': '${applicationName}で音声メモ',
    },
    localizable: {
      '음성으로 육아 기록': '音声で育児を記録',
      '아맞다 음성 기록 화면을 열고 바로 녹음을 시작합니다.':
        '音声記録画面を開いてすぐに録音を始めます。',
      '음성 기록': '音声記録',
    },
  },
  'zh-Hant': {
    appShortcuts: {
      '${applicationName} 육아': '${applicationName}記錄',
      '${applicationName} 기록': '${applicationName}做記錄',
      '${applicationName} 음성 기록': '${applicationName}語音記錄',
      '${applicationName} 음성': '${applicationName}語音',
    },
    localizable: {
      '음성으로 육아 기록': '用語音記錄育兒',
      '아맞다 음성 기록 화면을 열고 바로 녹음을 시작합니다.': '開啟語音記錄畫面並立即開始錄音。',
      '음성 기록': '語音記錄',
    },
  },
};

const STRINGS_FILES = ['AppShortcuts.strings', 'Localizable.strings'];

/** { key: value } → iOS .strings 포맷 문자열 */
function toStringsFile(dict) {
  return (
    Object.entries(dict)
      .map(([k, v]) => `"${k}" = "${v}";`)
      .join('\n') + '\n'
  );
}

/** 1) Swift 파일을 ios/<project>/ 에 작성 */
function withSwiftFile(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName;
      if (!projectName) return cfg;
      const destDir = path.join(iosRoot, projectName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, SWIFT_FILE), SWIFT_CONTENTS, 'utf8');
      return cfg;
    },
  ]);
}

/** 2) Xcode 프로젝트 빌드 소스에 Swift 파일 등록 (멱등) */
function withSwiftInXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const projectName = cfg.modRequest.projectName;
    if (!projectName) return cfg;

    const relPath = `${projectName}/${SWIFT_FILE}`;
    if (typeof proj.hasFile === 'function' && proj.hasFile(relPath)) {
      return cfg;
    }

    const target = proj.getFirstTarget().uuid;
    let groupKey = proj.findPBXGroupKey({ name: projectName });
    if (!groupKey) {
      groupKey = proj.getFirstProject().firstProject.mainGroup;
    }
    proj.addSourceFile(relPath, { target }, groupKey);
    return cfg;
  });
}

/** 3-a) 언어별 .lproj/*.strings 파일 작성 (Supporting/<lang>.lproj) */
function withSiriStringsFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName;
      if (!projectName) return cfg;
      const supportingDir = path.join(iosRoot, projectName, 'Supporting');
      for (const [lang, data] of Object.entries(SIRI_LOCALIZATIONS)) {
        const lprojDir = path.join(supportingDir, `${lang}.lproj`);
        fs.mkdirSync(lprojDir, { recursive: true });
        fs.writeFileSync(
          path.join(lprojDir, 'AppShortcuts.strings'),
          toStringsFile(data.appShortcuts),
          'utf8',
        );
        fs.writeFileSync(
          path.join(lprojDir, 'Localizable.strings'),
          toStringsFile(data.localizable),
          'utf8',
        );
      }
      return cfg;
    },
  ]);
}

/** 3-b) .strings 파일들을 Xcode 리소스로 등록 + knownRegion 추가 (멱등) */
function withSiriStringsInXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName;
    const projectRoot = cfg.modRequest.projectRoot;
    if (!projectName) return cfg;

    const supportingDir = path.join(projectRoot, 'ios', projectName, 'Supporting');

    for (const lang of Object.keys(SIRI_LOCALIZATIONS)) {
      project.addKnownRegion(lang);
      const groupName = `${projectName}/Supporting/${lang}.lproj`;
      const group = ensureGroupRecursively(project, groupName);
      for (const stringsName of STRINGS_FILES) {
        // 이미 등록돼 있으면 skip (prebuild 재실행 대비 멱등)
        const already = group?.children?.some((c) => c.comment === stringsName);
        if (already) continue;
        const fullPath = path.join(supportingDir, `${lang}.lproj`, stringsName);
        addResourceFileToGroup({
          filepath: path.relative(supportingDir, fullPath),
          groupName,
          project,
          isBuildFile: true,
          verbose: false,
        });
      }
    }
    // 기본(개발) 언어 = 한국어. Base 문구가 이미 한국어라 ko 디바이스는 그대로 사용.
    project.addKnownRegion('ko');
    return cfg;
  });
}

/** 3-c) 여러 언어 현지화 허용 (Info.plist) */
function withMixedLocalizations(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleAllowMixedLocalizations = true;
    return cfg;
  });
}

module.exports = function withIosSiriShortcut(config) {
  config = withSwiftFile(config);
  config = withSwiftInXcode(config);
  config = withSiriStringsFiles(config);
  config = withSiriStringsInXcode(config);
  config = withMixedLocalizations(config);
  return config;
};
