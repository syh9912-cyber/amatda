# 네이버 로그인 Key Hash 추출 스크립트
# 사용법:  .\get-naver-keyhash.ps1 -KeystorePath "C:\amatda\amatda-keystore-backup.jks" -StorePassword "비밀번호"

param(
  [Parameter(Mandatory=$true)][string]$KeystorePath,
  [Parameter(Mandatory=$true)][string]$StorePassword,
  [string]$Alias = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeystorePath)) {
  Write-Host "[ERROR] 키스토어 파일이 없습니다: $KeystorePath" -ForegroundColor Red
  exit 1
}

Write-Host "=== 키스토어 별칭 목록 ===" -ForegroundColor Cyan
$listOutput = & keytool -list -keystore $KeystorePath -storepass $StorePassword 2>&1
$listOutput | ForEach-Object { Write-Host $_ }

# Alias 자동 감지 (미지정 시)
if (-not $Alias) {
  $aliasLine = $listOutput | Where-Object { $_ -match "^\S+,.*PrivateKeyEntry" -or $_ -match "^\S+,.*trustedCertEntry" } | Select-Object -First 1
  if ($aliasLine) {
    $Alias = ($aliasLine -split ",")[0].Trim()
    Write-Host "`n[AUTO] 별칭 자동 감지됨: $Alias" -ForegroundColor Yellow
  } else {
    Write-Host "[ERROR] 별칭을 자동 감지하지 못했습니다. -Alias 로 직접 지정하세요." -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n=== 인증서 상세 (SHA-1, SHA-256) ===" -ForegroundColor Cyan
$detail = & keytool -list -v -keystore $KeystorePath -storepass $StorePassword -alias $Alias 2>&1
$detail | Select-String -Pattern "SHA1:|SHA256:" | ForEach-Object { Write-Host $_ }

# SHA-1 추출
$sha1Line = $detail | Select-String -Pattern "SHA1:" | Select-Object -First 1
if (-not $sha1Line) {
  Write-Host "[ERROR] SHA-1 을 찾지 못했습니다." -ForegroundColor Red
  exit 1
}
$sha1Hex = ($sha1Line -replace ".*SHA1:\s*", "").Trim().Replace(":", "")

# SHA-1 hex -> bytes -> Base64 (네이버 Key Hash 형식)
$bytes = for ($i = 0; $i -lt $sha1Hex.Length; $i += 2) {
  [Convert]::ToByte($sha1Hex.Substring($i, 2), 16)
}
$base64 = [Convert]::ToBase64String([byte[]]$bytes)

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "✅ 네이버/카카오 Key Hash (Base64 SHA-1):" -ForegroundColor Green
Write-Host "   $base64" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📌 이 값을 네이버 개발자센터 → Application → Android 환경 → Key Hash 란에 붙여넣으세요." -ForegroundColor Cyan
Write-Host "📌 SHA-1 (콜론 구분, 구글 콘솔용): " -ForegroundColor Cyan
Write-Host "   $(($sha1Line -replace '.*SHA1:\s*', '').Trim())" -ForegroundColor White
