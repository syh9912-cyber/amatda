/**
 * ⚠️ DEPRECATED — 2026-04-27 사용 중단
 *
 * 이 스크립트는 Gemini로 SOS 이미지를 생성했으나, AI가 한글을 못 그려서
 * 가짜 한글이 박힌 이미지가 만들어졌고 응급정보가 잘못 전달됨 (P0 사고).
 *
 * 현재 frontend/assets/sos-*.png 4장은 ChatGPT(GPT Image 1)로 사람이 직접
 * 검수해서 만든 정본임. 이 스크립트를 다시 실행하면 그 정본을 덮어써서
 * 다시 P0 사고가 발생함.
 *
 * 재실행 절대 금지. 이미지를 새로 만들어야 한다면:
 * 1) 새 파일명으로 생성 후 사람이 글자 검수
 * 2) 검수 통과 시에만 sos-*.png 교체
 * 3) docs/sos-image-prompts.md (있다면) 의 검수 체크리스트 사용
 */
process.stderr.write('[generate-sos-images] DEPRECATED — refusing to run. See file header for details.\n');
process.exit(1);

// ===== 아래 코드는 historical reference용으로만 보존 =====
/* eslint-disable */
//eslint-disable-next-line
const fs = require('fs');
const path = require('path');

// backend/.env 에서 API 키 로드 (없으면 환경변수에서)
let API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(/GEMINI_API_KEY=(.+)/);
    if (match) API_KEY = match[1].trim();
  }
}
if (!API_KEY) {
  console.error('GEMINI_API_KEY 를 찾을 수 없습니다.');
  process.exit(1);
}

const MODEL = 'gemini-2.0-flash-preview-image-generation';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'assets');

const GUIDES = [
  /* ── 하임리히법 ── */
  {
    file: 'sos-heimlich.png',
    prompt: `의료 응급처치 안내 포스터를 생성하세요. 모든 텍스트는 반드시 한국어(한글)로 표시하세요.

제목: 기도 폐쇄 응급처치 (하임리히법)
스타일: 깔끔한 벡터 플랫 일러스트, 흰 배경, 4단계 세로 배치, 각 단계는 둥근 모서리 박스
색상: 빨간 계열(#D32F2F) 헤더, 단계별 파스텔 배경

4단계 구성:

박스1 (연분홍 배경):
- 제목 텍스트(한글): "1. 등 두드리기 (1세 미만)"
- 그림: 아기를 엎어서 팔뚝 위에 45도로 기울여 얹은 어른이 등을 두드리는 모습
- 텍스트(한글): "등 정중앙 손바닥으로 5회"

박스2 (연분홍 배경):
- 제목 텍스트(한글): "2. 가슴 압박 (1세 미만)"
- 그림: 아기를 뒤집어 눕힌 뒤 두 손가락으로 가슴 중앙 압박하는 모습
- 텍스트(한글): "두 손가락 가슴 중앙 5회" + "깊이 약 4cm"

박스3 (연하늘 배경):
- 제목 텍스트(한글): "3. 복부 밀기 (1세 이상)"
- 그림: 어른이 아이 뒤에서 배꼽 위 주먹으로 위쪽으로 밀어 올리는 모습
- 텍스트(한글): "배꼽 위 주먹으로 위로 5회 밀기"

박스4 (연노랑 배경):
- 제목 텍스트(한글): "4. 나올 때까지 반복!"
- 그림: 반복 화살표 + 전화기에 "119" 표시
- 텍스트(한글): "의식 잃으면 → CPR + 119"
- 하단 경고(빨간 텍스트, 한글): "손가락으로 억지로 빼지 마세요!"

정사각형 이미지, 실제 응급상황에서 3초 안에 이해 가능한 명확한 디자인.`,
  },

  /* ── 심폐소생술 ── */
  {
    file: 'sos-cpr.png',
    prompt: `의료 응급처치 안내 포스터를 생성하세요. 모든 텍스트는 반드시 한국어(한글)로 표시하세요.

제목: 심폐소생술 (CPR)
스타일: 깔끔한 벡터 플랫 일러스트, 흰 배경, 4단계 세로 배치, 각 단계는 둥근 모서리 박스
색상: 진빨간 계열(#C62828) 헤더, 단계별 파스텔 배경

4단계 구성:

박스1 (연회색 배경):
- 제목 텍스트(한글): "1. 반응 확인 + 119 신고"
- 그림: 아기 어깨를 두드리는 어른 손 + 스피커폰 상태의 핸드폰(119 표시)
- 텍스트(한글): "의식 없으면 즉시 119 신고!"

박스2 (연하늘 배경):
- 제목 텍스트(한글): "2. 기도 열기"
- 그림: 아기 측면 — 머리를 뒤로 살짝 젖히고 턱 들어올리는 손 모습
- 텍스트(한글): "머리 뒤로 젖히기 + 턱 올리기" + 주의(한글): "너무 세게 젖히지 않기"

박스3 (연분홍 배경):
- 제목 텍스트(한글): "3. 가슴 압박 30회"
- 그림: 두 손가락으로 아기 가슴 중앙 압박, "x30" 큰 글씨
- 텍스트(한글): "깊이 4cm · 분당 100~120회"

박스4 (연초록 배경):
- 제목 텍스트(한글): "4. 인공호흡 2회 → 반복"
- 그림: 아기 코입 전체를 덮어 숨 불어넣는 모습 + "x2" + 순환 화살표 "30:2"
- 큰 강조 텍스트(한글, 빨간색): "구급대 올 때까지 멈추지 않기!"

정사각형 이미지, 실제 응급상황에서 3초 안에 이해 가능한 명확한 디자인.`,
  },

  /* ── 화상/낙상 ── */
  {
    file: 'sos-burn-fall.png',
    prompt: `의료 응급처치 안내 포스터를 생성하세요. 모든 텍스트는 반드시 한국어(한글)로 표시하세요.

제목: 화상 / 낙상 응급처치
스타일: 깔끔한 벡터 플랫 일러스트, 흰 배경, 4단계 세로 배치, 각 단계는 둥근 모서리 박스
색상: 주황 계열(#E65100) 헤더, 단계별 파스텔 배경

4단계 구성:

박스1 (연하늘 배경):
- 제목 텍스트(한글): "1. 화상: 흐르는 찬물 10분"
- 그림: 수도꼭지에서 흐르는 물이 아이 손/팔 위로 흐르는 모습 + 시계 "10분+" 표시
- X 표시와 함께(한글): "얼음 금지!" (얼음 아이콘에 빨간 X)

박스2 (연노랑 배경):
- 제목 텍스트(한글): "2. 화상: 깨끗한 천으로 덮기"
- 그림: 흰 거즈/천으로 화상 부위를 살짝 덮는 모습
- X 표시들과 함께(한글): "연고 금지", "치약 금지", "된장 금지"

박스3 (연초록 배경):
- 제목 텍스트(한글): "3. 낙상: 바로 움직이지 않기"
- 그림: 넘어진 아이 옆에 어른이 차분히 앉아서 안정시키는 모습 (일으키지 않음)
- X 표시와 함께(한글): "바로 일으키지 않기!"

박스4 (연보라 배경):
- 제목 텍스트(한글): "4. 낙상: 24시간 관찰"
- 그림: 눈 아이콘 + "24h" + 경고 징후 아이콘들(구토, 의식 저하, 경련)
- 강조 텍스트(한글, 빨간색): "이상 증상 → 즉시 응급실"

정사각형 이미지, 실제 응급상황에서 3초 안에 이해 가능한 명확한 디자인.`,
  },

  /* ── 이물질 ── */
  {
    file: 'sos-foreign.png',
    prompt: `의료 응급처치 안내 포스터를 생성하세요. 모든 텍스트는 반드시 한국어(한글)로 표시하세요.

제목: 이물질 삼킴 / 삽입 응급처치
스타일: 깔끔한 벡터 플랫 일러스트, 흰 배경, 4단계 세로 배치, 각 단계는 둥근 모서리 박스
색상: 호박색 계열(#F57F17) 헤더, 단계별 파스텔 배경

4단계 구성:

박스1 (연분홍 배경):
- 제목 텍스트(한글): "1. 억지로 빼지 않기!"
- 그림: 손이 아이 입에 들어가려는 모습에 크게 빨간 X
- 텍스트(한글): "더 깊이 들어갈 수 있어요"

박스2 (연하늘 배경):
- 제목 텍스트(한글): "2. 코에 넣었을 때"
- 그림: 아이 얼굴 측면 — 반대쪽 콧구멍을 손가락으로 막고 바람 불어넣는 모습(화살표로 반대쪽에서 이물질이 나오는 방향 표시)
- 텍스트(한글): "반대쪽 막고 훌! 불기" + "안 나오면 → 병원"

박스3 (연초록 배경):
- 제목 텍스트(한글): "3. 귀에 넣었을 때"
- 그림: 귀 모양 + 면봉에 빨간 X + 핀셋에 빨간 X + 병원 화살표
- 텍스트(한글): "도구 사용 절대 금지 → 병원"

박스4 (빨간 배경, 위험 강조):
- 제목 텍스트(한글, 흰색 큰 글씨): "4. 배터리·자석 → 즉시 응급실!"
- 그림: 단추형 배터리 아이콘 + 자석 아이콘 + 빨간 위험 심볼 + 구급차 화살표
- 경고 텍스트(한글, 흰색/노란색): "구토 유도 금지!" + "2시간 내 장 천공 위험!"
- 이 박스는 가장 위험해 보이도록 강조

정사각형 이미지, 실제 응급상황에서 3초 안에 이해 가능한 명확한 디자인.`,
  },
];

async function generateImage(guide) {
  console.log(`\n🎨 생성 중: ${guide.file} ...`);

  const body = {
    contents: [{ parts: [{ text: guide.prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 0.4,
    },
  };

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    // 모델명 불일치 시 fallback 모델 시도
    if (res.status === 404 || res.status === 400) {
      return null; // 호출자가 fallback 처리
    }
    console.error(`  실패 HTTP ${res.status}:`, err.slice(0, 300));
    return false;
  }

  const json = await res.json();
  const candidates = json.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const buf = Buffer.from(part.inlineData.data, 'base64');
        const outPath = path.join(OUT_DIR, guide.file);
        fs.writeFileSync(outPath, buf);
        console.log(`  ✅ 저장완료: ${guide.file} (${(buf.length / 1024).toFixed(0)} KB)`);
        return true;
      }
    }
  }

  console.error(`  이미지 데이터 없음`);
  if (candidates[0]?.content?.parts) {
    const textPart = candidates[0].content.parts.find(p => p.text);
    if (textPart) console.log('  텍스트 응답:', textPart.text.slice(0, 200));
  }
  return false;
}

async function generateWithFallback(guide) {
  // 1차 시도: 최신 이미지 생성 모델
  const MODELS = [
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.5-flash-image',
    'imagen-3.0-generate-002',
  ];

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const body = {
      contents: [{ parts: [{ text: guide.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.4,
      },
    };

    // imagen 모델은 다른 요청 형식
    if (model.startsWith('imagen')) {
      body.generationConfig = { numberOfImages: 1 };
      // imagen은 별도 엔드포인트
      continue;
    }

    console.log(`  모델 시도: ${model}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        console.log(`  → ${res.status} (다음 모델 시도)`);
        if (err.includes('not found') || err.includes('404')) continue;
        console.error(`  오류:`, err.slice(0, 200));
        continue;
      }

      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buf = Buffer.from(part.inlineData.data, 'base64');
          const outPath = path.join(OUT_DIR, guide.file);
          fs.writeFileSync(outPath, buf);
          console.log(`  ✅ 저장: ${guide.file} (${(buf.length / 1024).toFixed(0)} KB) [모델: ${model}]`);
          return true;
        }
      }
      const textPart = parts.find(p => p.text);
      if (textPart) console.log('  텍스트 응답:', textPart.text.slice(0, 150));
      console.log('  → 이미지 데이터 없음, 다음 모델 시도');
    } catch (e) {
      console.log(`  → 예외: ${e.message}`);
    }
  }
  return false;
}

async function main() {
  console.log('=== SOS 응급 가이드 이미지 생성 (Gemini 한글 최적화) ===\n');
  console.log(`출력 경로: ${OUT_DIR}\n`);

  let success = 0;
  for (const guide of GUIDES) {
    try {
      const ok = await generateWithFallback(guide);
      if (ok) success++;
      else console.error(`❌ ${guide.file} 생성 실패`);
    } catch (err) {
      console.error(`❌ 예외 발생 (${guide.file}):`, err.message);
    }
    // 레이트 리밋 대기
    if (success < GUIDES.length) await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\n완료: ${success}/${GUIDES.length} 이미지 생성됨`);
  if (success > 0) {
    console.log('\n다음 단계:');
    console.log('  cd frontend && npx eas update --branch production --message "SOS 이미지 업데이트"');
  }
}

main();
