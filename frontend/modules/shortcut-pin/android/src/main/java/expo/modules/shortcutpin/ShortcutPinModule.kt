package expo.modules.shortcutpin

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android pin shortcut native module.
 *
 * 사용자가 voice-settings 화면에서 "홈에 음성 단축 아이콘 추가" 버튼 탭하면
 * 안드로이드 시스템 다이얼로그 ("바로가기 추가") 표시 → 사용자 승인 시
 * 홈 화면에 별도 "음성 기록" 아이콘 생성. 1탭 = amatda://voice 딥링크.
 *
 * 동작 조건:
 *  - Android 8.0 (API 26, O) 이상
 *  - 런처가 pin shortcut 지원 (대부분 지원: 픽셀, 삼성 One UI, MIUI 등)
 *  - 런처가 미지원이면 isSupported=false → 안내 메시지 표시
 */
class ShortcutPinModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShortcutPin")

    AsyncFunction("isSupported") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      val sm = context.getSystemService(ShortcutManager::class.java) ?: return@AsyncFunction false
      sm.isRequestPinShortcutSupported
    }

    // ⚠️ 0-인자 시그니처로 유지 — 라벨은 한국어 기본값(현재 프로덕션 ko 고정).
    //   JS(modules/shortcut-pin/src/index.ts)도 0-인자로 호출한다. 둘 중 하나만 인자를
    //   바꾸면 OTA-네이티브 불일치("Received N arguments...")로 단축 생성이 깨진다 —
    //   다국어 라벨이 필요하면 반드시 index.ts + 이 파일 + 새 APK 빌드를 함께 진행할 것.
    AsyncFunction("requestPinVoiceShortcut") {
      val context = appContext.reactContext
        ?: throw RuntimeException("NO_CONTEXT")

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        throw RuntimeException("UNSUPPORTED_ANDROID_VERSION")
      }

      val sm = context.getSystemService(ShortcutManager::class.java)
        ?: throw RuntimeException("NO_SHORTCUT_MANAGER")

      if (!sm.isRequestPinShortcutSupported) {
        throw RuntimeException("LAUNCHER_UNSUPPORTED")
      }

      val iconResId = context.resources.getIdentifier(
        "ic_launcher",
        "mipmap",
        context.packageName,
      )

      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("amatda://voice")).apply {
        `package` = context.packageName
      }

      val info = ShortcutInfo.Builder(context, "voice_record_pinned")
        .setShortLabel("음성 기록")
        .setLongLabel("음성으로 기록하기")
        .apply { if (iconResId != 0) setIcon(Icon.createWithResource(context, iconResId)) }
        .setIntent(intent)
        .build()

      sm.requestPinShortcut(info, null)
    }
  }
}
