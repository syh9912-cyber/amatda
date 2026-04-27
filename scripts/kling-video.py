"""
Kling AI Image-to-Video Generator
- child-diary-final.png → 세로(9:16) 변환 → Kling API → splash-video.mp4
"""
import jwt
import time
import base64
import requests
import json
import sys
from PIL import Image
from io import BytesIO

# ── Kling AI Credentials ──
ACCESS_KEY = "ANCagfRn3at9AMhdTn83DF9mkbEKyRYB"
SECRET_KEY = "bFTLFyAHAErKyAg34n8THDCQRYKCDQ9E"
BASE_URL = "https://api.klingai.com"

# ── Paths ──
INPUT_IMAGE = "C:/amatda/frontend/assets/child-diary-final.png"
OUTPUT_VIDEO = "C:/amatda/frontend/assets/splash-video.mp4"

# ── JWT Token ──
def generate_token():
    now = int(time.time())
    headers = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": ACCESS_KEY,
        "exp": now + 1800,
        "nbf": now - 5
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256", headers=headers)

# ── Image Processing: 세로 9:16 비율로 변환 ──
def prepare_portrait_image(path):
    """원본 이미지를 9:16 세로 비율로 변환 (캐릭터 하단 배치, 상단 여백)"""
    img = Image.open(path).convert("RGBA")
    orig_w, orig_h = img.size
    print(f"  Original: {orig_w}x{orig_h}")

    # 목표: 720x1280 (9:16 portrait)
    target_w, target_h = 720, 1280

    # 캐릭터 크기 조정 (가로 기준 맞춤, 하단 70% 영역에 배치)
    char_area_h = int(target_h * 0.65)  # 캐릭터 영역 높이
    scale = min(target_w / orig_w, char_area_h / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)

    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # 배경: 따뜻한 크림색 (캐릭터 원본 배경과 유사)
    canvas = Image.new("RGB", (target_w, target_h), (255, 248, 240))

    # 캐릭터를 하단 중앙에 배치
    x_offset = (target_w - new_w) // 2
    y_offset = target_h - new_h - 40  # 하단 40px 여백

    # RGBA → RGB 합성
    canvas.paste(resized, (x_offset, y_offset), resized)

    # base64 인코딩
    buffer = BytesIO()
    canvas.save(buffer, format="JPEG", quality=92)
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    print(f"  Portrait: {target_w}x{target_h}, base64 length: {len(b64)}")
    return b64

# ── API Call: Image to Video ──
def create_task(token, image_b64):
    url = f"{BASE_URL}/v1/videos/image2video"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    prompt = (
        "A cute 3D clay-style baby character with short brown hair, rosy cheeks, "
        "wearing a mint green pajama with small bunny patterns, sitting at a small wooden desk. "
        "The baby is gently writing in an open diary book with a small pencil, "
        "the hand making subtle natural writing motions on the diary pages. "
        "Soft pink and red heart shapes float gently upward around the baby. "
        "The background is a warm, cozy children's bedroom with soft cream-colored walls, "
        "a small wooden bed with pastel pink and white bedding and a small plush bunny on it, "
        "a cute small wooden wardrobe with round knobs, stuffed animals on the floor, "
        "soft warm golden sunlight coming through a window with light curtains. "
        "Dreamy, warm, gentle atmosphere. The baby's face and body stay completely still and consistent, "
        "only the writing hand moves slightly. Smooth gentle loop-friendly animation. "
        "High quality 3D rendered Pixar-like style."
    )

    negative_prompt = (
        "morphing face, changing appearance, distorted features, extra fingers, "
        "blurry, low quality, text changes on diary, dark atmosphere, scary, "
        "realistic human, anime style change, flickering, jittery motion"
    )

    body = {
        "model_name": "kling-v1-6",
        "image": image_b64,
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "cfg_scale": 0.5,
        "mode": "std",
        "duration": "5"
    }

    print(f"  POST {url}")
    print(f"  model: {body['model_name']}, mode: {body['mode']}, duration: {body['duration']}")

    resp = requests.post(url, headers=headers, json=body, timeout=60)
    result = resp.json()
    print(f"  Response: code={result.get('code')}, message={result.get('message')}")
    return result

# ── Poll Task Status ──
def poll_task(token, task_id):
    url = f"{BASE_URL}/v1/videos/image2video/{task_id}"
    headers = {"Authorization": f"Bearer {token}"}

    start = time.time()
    while True:
        elapsed = int(time.time() - start)
        resp = requests.get(url, headers=headers, timeout=30)
        data = resp.json()

        status = data.get("data", {}).get("task_status", "unknown")
        msg = data.get("data", {}).get("task_status_msg", "")
        print(f"  [{elapsed}s] Status: {status} {msg}")

        if status == "succeed":
            videos = data["data"].get("task_result", {}).get("videos", [])
            if videos:
                return videos[0]["url"]
            print("  ERROR: No videos in result")
            return None

        elif status == "failed":
            print(f"  FAILED: {json.dumps(data, indent=2)}")
            return None

        if elapsed > 600:  # 10분 타임아웃
            print("  TIMEOUT after 10 minutes")
            return None

        time.sleep(10)

# ── Download Video ──
def download_video(url, output_path):
    print(f"  Downloading: {url[:80]}...")
    resp = requests.get(url, timeout=120)
    with open(output_path, "wb") as f:
        f.write(resp.content)
    size_mb = len(resp.content) / (1024 * 1024)
    print(f"  Saved: {output_path} ({size_mb:.1f} MB)")

# ── Main ──
def main():
    print("=" * 50)
    print("Kling AI Video Generator")
    print("=" * 50)

    # 1. JWT Token
    print("\n[1/5] Generating JWT token...")
    token = generate_token()
    print(f"  Token: {token[:40]}...")

    # 2. Image preparation
    print("\n[2/5] Preparing portrait image (9:16)...")
    image_b64 = prepare_portrait_image(INPUT_IMAGE)

    # 3. Create task
    print("\n[3/5] Creating image-to-video task...")
    result = create_task(token, image_b64)

    if result.get("code") != 0:
        print(f"\nERROR: {json.dumps(result, indent=2, ensure_ascii=False)}")
        sys.exit(1)

    task_id = result["data"]["task_id"]
    print(f"  Task ID: {task_id}")

    # 4. Poll for completion
    print("\n[4/5] Waiting for video generation...")
    video_url = poll_task(token, task_id)

    if not video_url:
        print("\nFAILED: No video URL returned")
        sys.exit(1)

    # 5. Download
    print("\n[5/5] Downloading video...")
    download_video(video_url, OUTPUT_VIDEO)

    print("\n" + "=" * 50)
    print("DONE! Video saved to:", OUTPUT_VIDEO)
    print("=" * 50)

if __name__ == "__main__":
    main()
