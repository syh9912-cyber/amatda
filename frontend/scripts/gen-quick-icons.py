"""
Quick menu icon generator — 기존 quick-X.png 3D 일러스트와 맞춰 새 일러스트 생성

Generated icons (192x192, RGBA):
  - quick-thermometer.png (열나)
  - quick-sprout.png       (성장 통계)
  - quick-syringe.png      (접종달력)
  - quick-baby.png         (주수별 발달)
  - quick-blood.png        (임당 관리)
  - quick-water.png        (물 마시기)
  - quick-pill.png         (영양제)

Style:
  - 파스텔 베이스 컬러 + 라이트 그라디언트 하이라이트 (위쪽)
  - 소프트 그림자 (아래쪽 옅은 회색)
  - 둥근 형태, 단순한 도형
  - 투명 배경 (앱에서 colored bg circle 위에 올림)

Run: python scripts/gen-quick-icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import os
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
SIZE = 192


def shadow(im: Image.Image) -> Image.Image:
    """소프트 그림자 (아래쪽)"""
    sh = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse((SIZE * 0.18, SIZE * 0.78, SIZE * 0.82, SIZE * 0.93),
               fill=(0, 0, 0, 50))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=8))
    return Image.alpha_composite(sh, im)


def highlight(draw: ImageDraw.Draw, x: float, y: float, r: float):
    """좌상단 광택 하이라이트"""
    for i, alpha in enumerate([60, 40, 20]):
        scale = 1 - i * 0.25
        rr = r * scale
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 255, 255, alpha))


def base_image() -> tuple[Image.Image, ImageDraw.Draw]:
    im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


# ─── 1. 체온계 (열나) ───
def gen_thermometer():
    im, d = base_image()
    # 본체 (긴 막대)
    body_w = 30
    cx = SIZE * 0.45
    body_top = SIZE * 0.18
    body_bot = SIZE * 0.72
    # 그림자 디테일
    d.rounded_rectangle((cx - body_w / 2 + 4, body_top + 4, cx + body_w / 2 + 4, body_bot + 4),
                        radius=body_w / 2, fill=(180, 100, 100, 80))
    # 본체
    d.rounded_rectangle((cx - body_w / 2, body_top, cx + body_w / 2, body_bot),
                        radius=body_w / 2, fill=(255, 230, 230, 255))
    # 빨강 액체
    fluid_top = SIZE * 0.42
    d.rounded_rectangle((cx - body_w / 2 + 7, fluid_top, cx + body_w / 2 - 7, body_bot - 5),
                        radius=(body_w - 14) / 2, fill=(232, 76, 76, 255))
    # 둥근 머리
    bulb_r = 32
    bulb_cy = body_bot + bulb_r * 0.3
    d.ellipse((cx - bulb_r, bulb_cy - bulb_r, cx + bulb_r, bulb_cy + bulb_r),
              fill=(232, 76, 76, 255))
    # 눈금 3개
    for i, y in enumerate([body_top + 16, body_top + 34, body_top + 52]):
        d.line((cx + body_w / 2 - 3, y, cx + body_w / 2 + 8, y), fill=(150, 100, 100, 200), width=3)
    # 광택
    highlight(d, cx - 6, body_top + 14, 7)
    highlight(d, cx - bulb_r * 0.4, bulb_cy - bulb_r * 0.4, 9)
    im = shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-thermometer.png'))
    print('✓ quick-thermometer.png')


# ─── 2. 새싹 (성장 통계) ───
def gen_sprout():
    im, d = base_image()
    # 화분/언덕 (베이스)
    base_y = SIZE * 0.78
    d.rounded_rectangle((SIZE * 0.22, base_y - 4, SIZE * 0.78, base_y + 26),
                        radius=14, fill=(218, 165, 110, 255))  # peach pot
    d.rounded_rectangle((SIZE * 0.18, base_y - 14, SIZE * 0.82, base_y - 4),
                        radius=8, fill=(232, 184, 130, 255))  # rim
    # 줄기
    cx = SIZE * 0.5
    d.rounded_rectangle((cx - 6, SIZE * 0.36, cx + 6, base_y - 4),
                        radius=4, fill=(110, 180, 110, 255))
    # 왼쪽 잎
    d.ellipse((SIZE * 0.20, SIZE * 0.40, SIZE * 0.55, SIZE * 0.62),
              fill=(150, 220, 130, 255))
    # 오른쪽 잎 (위로)
    d.ellipse((cx - 8, SIZE * 0.18, SIZE * 0.85, SIZE * 0.50),
              fill=(170, 230, 140, 255))
    # 광택
    highlight(d, SIZE * 0.62, SIZE * 0.26, 14)
    highlight(d, SIZE * 0.36, SIZE * 0.46, 9)
    im = shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-sprout.png'))
    print('✓ quick-sprout.png')


# ─── 3. 주사기 (접종달력) — 약간만 기울인 깔끔한 형태 ───
def gen_syringe():
    # 큰 캔버스(2x)에 수직으로 그리고 살짝 기울임 → 다운스케일
    big = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    cx = SIZE  # 중앙
    # 본체 (실린더, 세로 형태)
    body_top = SIZE * 0.55
    body_bot = SIZE * 1.40
    bd.rounded_rectangle((cx - 30, body_top, cx + 30, body_bot),
                         radius=4, fill=(230, 240, 250, 255))
    # 액체 (절반 채움 - 파랑)
    fluid_top = SIZE * 0.95
    bd.rounded_rectangle((cx - 24, fluid_top, cx + 24, body_bot - 4),
                         radius=3, fill=(120, 180, 235, 255))
    # 핑거 그립 (양쪽 날개)
    bd.rounded_rectangle((cx - 56, body_top - 6, cx + 56, body_top + 14),
                         radius=10, fill=(190, 210, 235, 255))
    # 플런저 막대
    bd.rounded_rectangle((cx - 8, SIZE * 0.30, cx + 8, body_top - 6),
                         radius=4, fill=(190, 210, 235, 255))
    # 플런저 헤드 (둥근 손잡이)
    bd.ellipse((cx - 22, SIZE * 0.20, cx + 22, SIZE * 0.36), fill=(160, 185, 220, 255))
    # 바늘 허브 (얇은 회색)
    bd.rounded_rectangle((cx - 10, body_bot, cx + 10, body_bot + 14),
                         radius=2, fill=(180, 195, 215, 255))
    # 바늘 (얇은 선)
    bd.rectangle((cx - 2, body_bot + 14, cx + 2, body_bot + 60),
                 fill=(140, 155, 175, 255))
    bd.polygon([
        (cx - 2, body_bot + 60),
        (cx + 2, body_bot + 60),
        (cx, body_bot + 72),
    ], fill=(140, 155, 175, 255))
    # 눈금 (왼쪽)
    for y_ratio in [0.65, 0.78, 0.91, 1.04, 1.17, 1.30]:
        bd.line((cx - 24, SIZE * y_ratio, cx - 14, SIZE * y_ratio),
                fill=(150, 170, 200, 220), width=3)
    # 광택
    for i, alpha in enumerate([100, 60, 30]):
        s = 1 - i * 0.3
        bd.ellipse((cx - 22 * s, body_top + 12, cx - 22 * s + 12 * s, body_top + 50),
                   fill=(255, 255, 255, alpha))
    # 살짝(15도) 기울임 → 활기있게
    big = big.rotate(20, resample=Image.BICUBIC, expand=False)
    cropped = big.crop((SIZE - SIZE // 2, SIZE - SIZE // 2,
                        SIZE + SIZE // 2, SIZE + SIZE // 2))
    cropped = cropped.resize((SIZE, SIZE), Image.LANCZOS)
    cropped = shadow(cropped)
    cropped.save(os.path.join(OUT_DIR, 'quick-syringe.png'))
    print('✓ quick-syringe.png')


# ─── 4. 아기 (주수별 발달) — 동그란 얼굴 ───
def gen_baby():
    im, d = base_image()
    # 얼굴 (피부 톤)
    cx, cy, r = SIZE / 2, SIZE * 0.52, 60
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 220, 195, 255))
    # 머리카락 (한 다발)
    d.ellipse((cx - 14, cy - r - 6, cx + 14, cy - r + 18), fill=(120, 80, 60, 255))
    # 볼 (분홍 동그라미)
    d.ellipse((cx - r + 12, cy + 5, cx - r + 30, cy + 22), fill=(255, 180, 180, 200))
    d.ellipse((cx + r - 30, cy + 5, cx + r - 12, cy + 22), fill=(255, 180, 180, 200))
    # 눈 (감은 눈 — 호 모양)
    d.arc((cx - 24, cy - 12, cx - 6, cy + 6), start=200, end=340, fill=(80, 50, 40, 255), width=3)
    d.arc((cx + 6, cy - 12, cx + 24, cy + 6), start=200, end=340, fill=(80, 50, 40, 255), width=3)
    # 입 (작은 미소)
    d.arc((cx - 12, cy + 10, cx + 12, cy + 26), start=20, end=160, fill=(180, 100, 80, 255), width=3)
    # 하이라이트
    highlight(d, cx - r * 0.4, cy - r * 0.4, 14)
    im = shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-baby.png'))
    print('✓ quick-baby.png')


def teardrop(color: tuple) -> Image.Image:
    """올바른 물방울 형태 (위 뾰족, 아래 둥근) — bottom circle + top triangle 합성"""
    im, d = base_image()
    cx = SIZE / 2
    # 아래쪽 원
    bottom_cy = SIZE * 0.65
    r = 52
    d.ellipse((cx - r, bottom_cy - r, cx + r, bottom_cy + r), fill=color)
    # 위쪽 삼각형 (뾰족한 위)
    tip_y = SIZE * 0.18
    # 양쪽 접점 (원의 위쪽 ~30°)
    angle = math.radians(60)  # 60도에서 만남
    left_x = cx - r * math.sin(angle)
    right_x = cx + r * math.sin(angle)
    edge_y = bottom_cy - r * math.cos(angle)
    d.polygon([
        (cx, tip_y),
        (left_x, edge_y),
        (right_x, edge_y),
    ], fill=color)
    # 부드러운 연결을 위한 추가 채움 (사각형으로 갭 메움)
    d.polygon([
        (cx, tip_y),
        (left_x - 2, edge_y + 2),
        (cx, bottom_cy),
        (right_x + 2, edge_y + 2),
    ], fill=color)
    # 광택 (좌상단)
    highlight(d, cx - 16, SIZE * 0.42, 14)
    highlight(d, cx - 22, SIZE * 0.36, 7)
    return shadow(im)


# ─── 5. 핏방울 (임당 관리) ───
def gen_blood():
    im = teardrop((220, 60, 70, 255))
    im.save(os.path.join(OUT_DIR, 'quick-blood.png'))
    print('✓ quick-blood.png')


# ─── 6. 물방울 (물 마시기) ───
def gen_water():
    im = teardrop((80, 165, 235, 255))
    im.save(os.path.join(OUT_DIR, 'quick-water.png'))
    print('✓ quick-water.png')


# ─── 7. 알약 (영양제) ───
def gen_pill():
    im, d = base_image()
    big = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    # 캡슐 (가로)
    cx, cy = SIZE, SIZE
    w, h = 220, 100
    # 왼쪽 (보라)
    bd.rounded_rectangle((cx - w / 2, cy - h / 2, cx, cy + h / 2),
                         radius=h / 2, fill=(160, 100, 200, 255))
    bd.rounded_rectangle((cx - h / 2, cy - h / 2, cx, cy + h / 2),
                         fill=(160, 100, 200, 255))
    # 오른쪽 (오렌지)
    bd.rounded_rectangle((cx, cy - h / 2, cx + w / 2, cy + h / 2),
                         radius=h / 2, fill=(255, 160, 90, 255))
    bd.rounded_rectangle((cx, cy - h / 2, cx + h / 2, cy + h / 2),
                         fill=(255, 160, 90, 255))
    # 중앙 분리선
    bd.line((cx, cy - h / 2 + 4, cx, cy + h / 2 - 4), fill=(255, 255, 255, 60), width=2)
    # 광택
    bd.ellipse((cx - w / 2 + 14, cy - h / 2 + 12, cx - w / 2 + 50, cy - h / 2 + 30),
               fill=(255, 255, 255, 90))
    bd.ellipse((cx + 24, cy - h / 2 + 12, cx + 60, cy - h / 2 + 30),
               fill=(255, 255, 255, 100))
    # 회전 (-25도)
    big = big.rotate(-25, resample=Image.BICUBIC, expand=False)
    cropped = big.crop((SIZE - SIZE // 2, SIZE - SIZE // 2,
                        SIZE + SIZE // 2, SIZE + SIZE // 2))
    cropped = cropped.resize((SIZE, SIZE), Image.LANCZOS)
    cropped = shadow(cropped)
    cropped.save(os.path.join(OUT_DIR, 'quick-pill.png'))
    print('✓ quick-pill.png')


if __name__ == '__main__':
    print('Generating quick menu icons...')
    gen_thermometer()
    gen_sprout()
    gen_syringe()
    gen_baby()
    gen_blood()
    gen_water()
    gen_pill()
    print('\nDone! Files saved to:', OUT_DIR)
