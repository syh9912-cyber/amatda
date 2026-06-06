/**
 * withIosSiriShortcut.js
 *
 * iOS App Intents(앱 내장 시리 명령) 추가 — "시리야, 아맞다 육아" → 음성 기록 화면 자동 열기 + 녹음 시작.
 * (Apple 규칙상 문구에 앱 이름 필수 + 앱이름 단독은 "앱 열기"와 충돌 → "아맞다 육아"처럼 동작어를 붙임)
 *
 * 동작:
 *   1) prebuild 시 ios/<project>/AmatdaSiriShortcut.swift 생성
 *   2) Xcode 프로젝트 메인 타깃 빌드 소스에 추가
 *
 * Swift(App Intents, iOS 16+):
 *   - AmatdaVoiceRecordIntent.perform → openAppWhenRun(앱 전면) + NSUserDefaults 플래그 기록
 *     → RN(react-native Settings)이 플래그 감지 → /voice 이동 → 텍스트 없는 진입(Case 2) → 음성 인식 자동 시작
 *     (OpenURLIntent 은 커스텀 스킴 실행 차단되어 미사용)
 *   - AmatdaAppShortcuts: "아맞다 육아", "아맞다 기록", "아맞다 음성 기록" 문구 등록
 *     (Apple 규칙상 문구에 앱 이름 \(.applicationName) 필수)
 *
 * ※ 네이티브 변경이라 OTA 불가 — 새 빌드부터 적용. deploymentTarget 16.0 필요(이미 설정됨).
 */
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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

module.exports = function withIosSiriShortcut(config) {
  config = withSwiftFile(config);
  config = withSwiftInXcode(config);
  return config;
};
