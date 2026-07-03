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

    // shortLabel/longLabel 은 JS(앱 로케일)에서 전달 — 다국어 대응. 미전달 시 한국어 기본값.
    AsyncFunction("requestPinVoiceShortcut") { shortLabel: String?, longLabel: String? ->
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
        .setShortLabel(shortLabel ?: "음성 기록")
        .setLongLabel(longLabel ?: "음성으로 기록하기")
        .apply { if (iconResId != 0) setIcon(Icon.createWithResource(context, iconResId)) }
        .setIntent(intent)
        .build()

      sm.requestPinShortcut(info, null)
    }
  }
}
