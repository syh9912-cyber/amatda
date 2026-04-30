"""
Quick menu icon generator (3D feel) — 기존 quick-X.png 일러스트와 통일

생성 (192x192 RGBA):
  - quick-thermometer.png  (열나)
  - quick-sprout.png       (성장 통계)
  - quick-syringe.png      (접종달력)
  - quick-baby.png         (주수별 발달)
  - quick-blood.png        (임당 관리)
  - quick-water.png        (물 마시기)
  - quick-pill.png         (영양제)

3D 느낌 구현:
  - 라이트 그라디언트 (위 밝게 ↑, 아래 어둡게 ↓)
  - 좌상단 specular highlight (백색 부드러운 광택)
  - 우하단 코어 섀도우 (살짝 어두운 톤)
  - 베이스 외곽 라인 없음 (매끈한 형태)
  - 아래쪽 ground shadow (블러)

Run:
  PYTHONIOENCODING=utf-8 python scripts/gen-quick-icons.py
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
SIZE = 192


# ───────────── 공통 도우미 ─────────────

def make_canvas(size: int = SIZE) -> Image.Image:
    return Image.new('RGBA', (size, size), (0, 0, 0, 0))


def vlerp(a: tuple, b: tuple, t: float) -> tuple:
    """(R,G,B[,A]) 선형 보간"""
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def gradient_ellipse(
    base: Image.Image,
    bbox: tuple,
    color_top: tuple,
    color_bot: tuple,
):
    """
    bbox 안에 세로 방향 그라디언트로 채워진 타원을 그림.
    color_top: (R,G,B,A) — 위쪽 (밝음)
    color_bot: (R,G,B,A) — 아래쪽 (어두움)
    """
    x0, y0, x1, y1 = [int(v) for v in bbox]
    h = y1 - y0
    if h <= 0:
        return
    # 마스크 (타원 내부)
    mask = Image.new('L', (x1 - x0, h), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((0, 0, x1 - x0 - 1, h - 1), fill=255)
    # 그라디언트 layer
    grad = Image.new('RGBA', (x1 - x0, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / max(1, h - 1)
        c = vlerp(color_top, color_bot, t)
        gd.line((0, y, x1 - x0 - 1, y), fill=c)
    # 합성
    base.paste(grad, (x0, y0), mask)


def gradient_round_rect(
    base: Image.Image,
    bbox: tuple,
    radius: int,
    color_top: tuple,
    color_bot: tuple,
):
    x0, y0, x1, y1 = [int(v) for v in bbox]
    w = x1 - x0
    h = y1 - y0
    if w <= 0 or h <= 0:
        return
    mask = Image.new('L', (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    grad = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / max(1, h - 1)
        c = vlerp(color_top, color_bot, t)
        gd.line((0, y, w - 1, y), fill=c)
    base.paste(grad, (x0, y0), mask)


def soft_specular(base: Image.Image, x: float, y: float, rx: float, ry: float, alpha: int = 220):
    """좌상단 광택 (큰 부드러운 흰색 타원, 블러)"""
    layer = make_canvas()
    d = ImageDraw.Draw(layer)
    d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(255, 255, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=8))
    base.alpha_composite(layer)


def small_specular(base: Image.Image, x: float, y: float, r: float, alpha: int = 255):
    """선명한 작은 광점 (화룡점정)"""
    layer = make_canvas()
    d = ImageDraw.Draw(layer)
    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=2))
    base.alpha_composite(layer)


def core_shadow(base: Image.Image, x: float, y: float, rx: float, ry: float, color: tuple, alpha: int = 110):
    """우하단 코어 섀도우 (베이스 색의 더 어두운 톤)"""
    layer = make_canvas()
    d = ImageDraw.Draw(layer)
    d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(*color[:3], alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=14))
    base.alpha_composite(layer)


def ground_shadow(base: Image.Image) -> Image.Image:
    """아래쪽 그림자 (블러된 타원)"""
    sh = make_canvas()
    sd = ImageDraw.Draw(sh)
    sd.ellipse((SIZE * 0.18, SIZE * 0.82, SIZE * 0.82, SIZE * 0.93),
               fill=(60, 50, 50, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=10))
    return Image.alpha_composite(sh, base)


# ───────────── 도형별 생성 함수 ─────────────

def gen_water_drop(out_path: str, base_color: tuple):
    """물방울/핏방울 — 위 뾰족 + 아래 둥근, 3D 그라디언트"""
    im = make_canvas()
    cx = SIZE / 2
    # 메인 형태: 큰 원 + 위쪽 삼각형
    bottom_cy = SIZE * 0.62
    r = 56
    # 그라디언트 색상 — 베이스보다 위는 연하게
    light = tuple(min(255, c + 50) for c in base_color[:3]) + (255,)
    deep = tuple(max(0, c - 50) for c in base_color[:3]) + (255,)
    # 아래쪽 둥근 부분 (그라디언트)
    gradient_ellipse(im, (cx - r, bottom_cy - r, cx + r, bottom_cy + r), light, deep)
    # 위쪽 삼각형 (단색 base — 그라디언트 자연스러운 보간을 위해 위는 light에 가깝게)
    tip_y = SIZE * 0.16
    angle = math.radians(60)
    left_x = cx - r * math.sin(angle)
    right_x = cx + r * math.sin(angle)
    edge_y = bottom_cy - r * math.cos(angle)
    # 삼각형 그라디언트도 흉내내기 위해 segment-by-segment paste
    seg_h = int(edge_y - tip_y)
    if seg_h > 0:
        tri_mask = Image.new('L', (SIZE, seg_h), 0)
        tmd = ImageDraw.Draw(tri_mask)
        tmd.polygon([
            (cx, 0),
            (left_x, seg_h),
            (right_x, seg_h),
        ], fill=255)
        tri_grad = Image.new('RGBA', (SIZE, seg_h), (0, 0, 0, 0))
        tgd = ImageDraw.Draw(tri_grad)
        for y in range(seg_h):
            t = y / max(1, seg_h - 1)
            c = vlerp(light, base_color, t)
            tgd.line((0, y, SIZE - 1, y), fill=c)
        im.paste(tri_grad, (0, int(tip_y)), tri_mask)

    # 코어 섀도우 (우하단)
    core_shadow(im, cx + 22, bottom_cy + 22, 30, 22, deep, alpha=120)
    # 부드러운 좌상단 광택
    soft_specular(im, cx - 14, SIZE * 0.40, 22, 28, alpha=180)
    # 작은 화이트 점 (3D rendered look)
    small_specular(im, cx - 18, SIZE * 0.36, 5)
    # 아래 그림자
    im = ground_shadow(im)
    im.save(out_path)


def gen_thermometer():
    im = make_canvas()
    cx = SIZE * 0.46
    body_w = 32
    body_top = SIZE * 0.16
    body_bot = SIZE * 0.70

    # 본체 그라디언트 (흰빛 → 살짝 핑크)
    light = (255, 245, 245, 255)
    deep = (235, 215, 215, 255)
    gradient_round_rect(im,
                        (cx - body_w / 2, body_top, cx + body_w / 2, body_bot),
                        radius=int(body_w / 2),
                        color_top=light, color_bot=deep)
    # 액체 (빨간 그라디언트 — 위 연한 빨강 → 아래 진한 빨강)
    fluid_top = SIZE * 0.40
    fluid_light = (255, 140, 140, 255)
    fluid_deep = (200, 50, 60, 255)
    gradient_round_rect(im,
                        (cx - body_w / 2 + 6, fluid_top, cx + body_w / 2 - 6, body_bot - 4),
                        radius=int((body_w - 12) / 2),
                        color_top=fluid_light, color_bot=fluid_deep)

    # 둥근 머리 (빨강 그라디언트)
    bulb_r = 36
    bulb_cy = body_bot + bulb_r * 0.35
    gradient_ellipse(im,
                     (cx - bulb_r, bulb_cy - bulb_r, cx + bulb_r, bulb_cy + bulb_r),
                     fluid_light, fluid_deep)

    # 코어 섀도우 (둥근 머리 우하단)
    core_shadow(im, cx + bulb_r * 0.3, bulb_cy + bulb_r * 0.3, 26, 20, fluid_deep, alpha=140)

    # 눈금 (살짝 짙은 회색)
    d = ImageDraw.Draw(im)
    for y_ratio in [0.21, 0.28, 0.35]:
        y = SIZE * y_ratio
        d.line((cx + body_w / 2 - 2, y, cx + body_w / 2 + 9, y),
               fill=(150, 100, 100, 220), width=3)

    # 광택
    soft_specular(im, cx - 7, body_top + 16, 6, 18, alpha=200)  # 본체 상단
    soft_specular(im, cx - bulb_r * 0.4, bulb_cy - bulb_r * 0.4, 12, 12, alpha=200)  # 머리
    small_specular(im, cx - bulb_r * 0.5, bulb_cy - bulb_r * 0.5, 5)
    small_specular(im, cx - 4, body_top + 22, 3)

    im = ground_shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-thermometer.png'))
    print('OK quick-thermometer.png')


def gen_sprout():
    """새싹 — 흙 + 줄기 + 두 잎(잎 모양 끝이 뾰족하게)"""
    im = make_canvas()
    cx = SIZE * 0.5

    # 흙 (둥근 무덤 형태)
    soil_light = (165, 110, 75, 255)
    soil_deep = (105, 70, 45, 255)
    soil_y = SIZE * 0.78
    gradient_ellipse(im,
                     (SIZE * 0.20, soil_y - 6, SIZE * 0.80, soil_y + 30),
                     soil_light, soil_deep)
    # 흙 윗면 (살짝 어두운 라인 — 단면)
    d = ImageDraw.Draw(im)
    d.ellipse((SIZE * 0.20, soil_y - 6, SIZE * 0.80, soil_y + 8),
              fill=(80, 55, 35, 255))

    # 줄기
    stem_light = (140, 200, 130, 255)
    stem_deep = (95, 155, 90, 255)
    gradient_round_rect(im,
                        (cx - 5, SIZE * 0.42, cx + 5, soil_y + 4),
                        radius=3,
                        color_top=stem_light, color_bot=stem_deep)

    # 잎 색상
    leaf_light = (185, 235, 160, 255)
    leaf_deep = (105, 175, 100, 255)

    # 왼쪽 잎 — 폴리곤 잎 형태 (긴 타원 + 끝 뾰족)
    def draw_leaf(canvas, base_x, base_y, length, width, angle_deg):
        leaf_layer = make_canvas(SIZE * 2)
        # 큰 캔버스에 수평으로 잎 그리기 (베이스 = 좌측, 끝 = 우측)
        cx2 = SIZE
        cy2 = SIZE
        # 잎 모양: 두 베지어 같은 호 (위/아래) — 폴리곤 근사
        points_top = []
        points_bot = []
        steps = 30
        for i in range(steps + 1):
            t = i / steps
            x = cx2 + length * t
            # 잎의 폭은 가운데가 가장 두껍고 양 끝은 뾰족
            w = width * math.sin(math.pi * t) ** 1.0
            points_top.append((x, cy2 - w))
            points_bot.append((x, cy2 + w))
        polygon_pts = points_top + list(reversed(points_bot))
        ld = ImageDraw.Draw(leaf_layer)
        ld.polygon(polygon_pts, fill=leaf_deep)
        # 그라디언트 위치 마스킹 — 위는 light, 아래는 deep
        # 단순 화이트 하이라이트 추가
        hl = make_canvas(SIZE * 2)
        hd = ImageDraw.Draw(hl)
        for i in range(steps + 1):
            t = i / steps
            x = cx2 + length * t
            w = width * math.sin(math.pi * t) ** 1.0 * 0.4
            hd.line((x, cy2 - w * 1.2, x, cy2 - w * 0.2),
                    fill=vlerp(leaf_light, leaf_deep, 0.2), width=2)
        hl = hl.filter(ImageFilter.GaussianBlur(radius=4))
        leaf_layer.alpha_composite(hl)
        # 회전 + 중심 이동
        leaf_layer = leaf_layer.rotate(angle_deg, resample=Image.BICUBIC, center=(cx2, cy2))
        # 베이스 위치로 이동
        offset_x = int(base_x - cx2)
        offset_y = int(base_y - cy2)
        canvas.alpha_composite(leaf_layer, (offset_x, offset_y))

    # 줄기 베이스 (잎이 시작되는 지점)
    stem_top = SIZE * 0.42
    # 왼쪽 잎 (좌상향)
    draw_leaf(im, cx - 2, stem_top + 12, length=58, width=18, angle_deg=160)
    # 오른쪽 잎 (우상향, 더 큰 잎)
    draw_leaf(im, cx + 2, stem_top + 4, length=68, width=22, angle_deg=-20)

    # 광택
    soft_specular(im, SIZE * 0.66, SIZE * 0.28, 14, 10, alpha=180)
    soft_specular(im, SIZE * 0.36, SIZE * 0.48, 9, 8, alpha=160)
    soft_specular(im, SIZE * 0.40, soil_y + 8, 28, 5, alpha=120)
    small_specular(im, SIZE * 0.66, SIZE * 0.24, 4)
    small_specular(im, SIZE * 0.38, SIZE * 0.46, 3)

    im = ground_shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-sprout.png'))
    print('OK quick-sprout.png')


def gen_syringe():
    big = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    cx = SIZE
    body_top = SIZE * 0.55
    body_bot = SIZE * 1.40

    # 본체 (실린더) — 흰색 → 매우 옅은 파랑
    light = (250, 252, 255, 255)
    deep = (215, 230, 245, 255)
    gradient_round_rect(big,
                        (cx - 30, body_top, cx + 30, body_bot),
                        radius=4,
                        color_top=light, color_bot=deep)

    # 액체 (파랑)
    fluid_light = (155, 205, 245, 255)
    fluid_deep = (90, 160, 220, 255)
    gradient_round_rect(big,
                        (cx - 24, SIZE * 0.95, cx + 24, body_bot - 4),
                        radius=3,
                        color_top=fluid_light, color_bot=fluid_deep)

    # 핑거 그립 (양쪽 날개)
    grip_light = (210, 225, 245, 255)
    grip_deep = (165, 185, 215, 255)
    gradient_round_rect(big,
                        (cx - 56, body_top - 6, cx + 56, body_top + 14),
                        radius=10,
                        color_top=grip_light, color_bot=grip_deep)

    # 플런저 막대
    gradient_round_rect(big,
                        (cx - 8, SIZE * 0.30, cx + 8, body_top - 6),
                        radius=4,
                        color_top=grip_light, color_bot=grip_deep)
    # 플런저 헤드
    gradient_ellipse(big,
                     (cx - 22, SIZE * 0.18, cx + 22, SIZE * 0.36),
                     grip_light, grip_deep)

    # 바늘 허브
    bd.rounded_rectangle((cx - 10, body_bot, cx + 10, body_bot + 14),
                         radius=2, fill=(165, 180, 200, 255))
    # 바늘
    bd.rectangle((cx - 2, body_bot + 14, cx + 2, body_bot + 60),
                 fill=(125, 140, 160, 255))
    bd.polygon([
        (cx - 2, body_bot + 60),
        (cx + 2, body_bot + 60),
        (cx, body_bot + 72),
    ], fill=(125, 140, 160, 255))

    # 눈금
    for y_ratio in [0.65, 0.78, 0.91, 1.04, 1.17, 1.30]:
        bd.line((cx - 24, SIZE * y_ratio, cx - 14, SIZE * y_ratio),
                fill=(140, 165, 195, 230), width=3)

    # 코어 섀도우
    core_shadow(big, cx + 18, SIZE * 1.30, 32, 24, fluid_deep, alpha=110)

    # 광택
    soft_specular(big, cx - 18, body_top + 30, 12, 28, alpha=200)  # 실린더 상단
    soft_specular(big, cx - 18, SIZE * 1.05, 8, 16, alpha=160)     # 액체
    small_specular(big, cx - 16, body_top + 24, 4)
    small_specular(big, cx - 18, SIZE * 0.24, 5)

    # 회전(20도)
    big = big.rotate(20, resample=Image.BICUBIC, expand=False)
    cropped = big.crop((SIZE - SIZE // 2, SIZE - SIZE // 2,
                        SIZE + SIZE // 2, SIZE + SIZE // 2))
    cropped = cropped.resize((SIZE, SIZE), Image.LANCZOS)
    cropped = ground_shadow(cropped)
    cropped.save(os.path.join(OUT_DIR, 'quick-syringe.png'))
    print('OK quick-syringe.png')


def gen_baby():
    im = make_canvas()
    cx, cy, r = SIZE / 2, SIZE * 0.52, 62
    # 얼굴 — 그라디언트
    skin_light = (255, 230, 210, 255)
    skin_deep = (235, 195, 165, 255)
    gradient_ellipse(im, (cx - r, cy - r, cx + r, cy + r), skin_light, skin_deep)
    # 코어 섀도우 (우하단)
    core_shadow(im, cx + r * 0.35, cy + r * 0.35, 32, 26, skin_deep, alpha=130)
    # 머리카락 (짧은 다발)
    hair_light = (140, 95, 70, 255)
    hair_deep = (95, 65, 50, 255)
    gradient_ellipse(im,
                     (cx - 16, cy - r - 8, cx + 16, cy - r + 18),
                     hair_light, hair_deep)
    # 볼 (분홍)
    layer = make_canvas()
    ld = ImageDraw.Draw(layer)
    ld.ellipse((cx - r + 10, cy + 6, cx - r + 30, cy + 22), fill=(255, 175, 175, 220))
    ld.ellipse((cx + r - 30, cy + 6, cx + r - 10, cy + 22), fill=(255, 175, 175, 220))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=2))
    im.alpha_composite(layer)
    # 눈 (감은 호)
    d = ImageDraw.Draw(im)
    d.arc((cx - 24, cy - 12, cx - 6, cy + 6), start=200, end=340,
          fill=(75, 50, 35, 255), width=3)
    d.arc((cx + 6, cy - 12, cx + 24, cy + 6), start=200, end=340,
          fill=(75, 50, 35, 255), width=3)
    # 입
    d.arc((cx - 11, cy + 11, cx + 11, cy + 26), start=20, end=160,
          fill=(170, 95, 75, 255), width=3)

    # 광택
    soft_specular(im, cx - r * 0.45, cy - r * 0.45, 16, 14, alpha=210)
    small_specular(im, cx - r * 0.55, cy - r * 0.5, 6)
    small_specular(im, cx + 5, cy - r * 0.6, 4, alpha=200)

    im = ground_shadow(im)
    im.save(os.path.join(OUT_DIR, 'quick-baby.png'))
    print('OK quick-baby.png')


def gen_blood():
    out = os.path.join(OUT_DIR, 'quick-blood.png')
    gen_water_drop(out, base_color=(220, 60, 70, 255))
    print('OK quick-blood.png')


def gen_water():
    out = os.path.join(OUT_DIR, 'quick-water.png')
    gen_water_drop(out, base_color=(85, 175, 235, 255))
    print('OK quick-water.png')


def gen_pill():
    """캡슐 알약 — 좌(보라) + 우(오렌지). 단일 rounded_rect 두 개로 깔끔하게."""
    big = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    cx, cy = SIZE, SIZE
    half_w = 115
    h = 110

    # 왼쪽 절반 (보라) — rounded_rect가 좌측만 둥글게 되도록 폭은 half_w + h/2 (오른쪽 둥근 부분 살짝 가림)
    pl_light = (195, 140, 235, 255)
    pl_deep = (130, 75, 175, 255)
    gradient_round_rect(big,
                        (cx - half_w, cy - h / 2, cx, cy + h / 2),
                        radius=int(h / 2),
                        color_top=pl_light, color_bot=pl_deep)
    # 왼쪽 캡슐의 오른쪽 끝 (사각형 채움 — 둥근 모서리 제거)
    bd.rectangle((cx - h / 2, cy - h / 2, cx, cy + h / 2), fill=pl_deep)
    # 그라디언트 다시 한 번 사각형 영역 위에 (수직)
    rect_grad = Image.new('RGBA', (int(h / 2), h), (0, 0, 0, 0))
    rgd = ImageDraw.Draw(rect_grad)
    for y in range(h):
        t = y / max(1, h - 1)
        c = vlerp(pl_light, pl_deep, t)
        rgd.line((0, y, int(h / 2) - 1, y), fill=c)
    big.paste(rect_grad, (cx - int(h / 2), int(cy - h / 2)))

    # 오른쪽 절반 (오렌지)
    or_light = (255, 195, 130, 255)
    or_deep = (240, 130, 60, 255)
    gradient_round_rect(big,
                        (cx, cy - h / 2, cx + half_w, cy + h / 2),
                        radius=int(h / 2),
                        color_top=or_light, color_bot=or_deep)
    bd.rectangle((cx, cy - h / 2, cx + h / 2, cy + h / 2), fill=or_deep)
    rect_grad2 = Image.new('RGBA', (int(h / 2), h), (0, 0, 0, 0))
    rgd2 = ImageDraw.Draw(rect_grad2)
    for y in range(h):
        t = y / max(1, h - 1)
        c = vlerp(or_light, or_deep, t)
        rgd2.line((0, y, int(h / 2) - 1, y), fill=c)
    big.paste(rect_grad2, (cx, int(cy - h / 2)))

    # 중앙 미세 분리선 (살짝 짙은 톤으로 자연스럽게)
    bd.line((cx, cy - h / 2 + 6, cx, cy + h / 2 - 6),
            fill=(0, 0, 0, 50), width=2)

    # 코어 섀도우
    core_shadow(big, cx - 50, cy + 22, 60, 22, pl_deep, alpha=110)
    core_shadow(big, cx + 60, cy + 22, 50, 22, or_deep, alpha=110)

    # 광택 (각 캡슐마다 — 위쪽 길게)
    soft_specular(big, cx - 55, cy - 28, 36, 10, alpha=210)
    soft_specular(big, cx + 55, cy - 28, 36, 10, alpha=220)
    small_specular(big, cx - 75, cy - 30, 6)
    small_specular(big, cx + 35, cy - 30, 6)

    # 회전 (-20도)
    big = big.rotate(-20, resample=Image.BICUBIC, expand=False)
    cropped = big.crop((SIZE - SIZE // 2, SIZE - SIZE // 2,
                        SIZE + SIZE // 2, SIZE + SIZE // 2))
    cropped = cropped.resize((SIZE, SIZE), Image.LANCZOS)
    cropped = ground_shadow(cropped)
    cropped.save(os.path.join(OUT_DIR, 'quick-pill.png'))
    print('OK quick-pill.png')


if __name__ == '__main__':
    print('Generating 3D-style quick menu icons...')
    gen_thermometer()
    gen_sprout()
    gen_syringe()
    gen_baby()
    gen_blood()
    gen_water()
    gen_pill()
    print('\nDone! Files saved to:', OUT_DIR)
