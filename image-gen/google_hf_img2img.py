"""End-to-end pipeline: CSV -> Google Custom Search (image) -> Hugging Face img2img -> output images.

Requirements:
  pip install requests python-dotenv (optional)

Environment variables used (pulled from your existing .env.local):
  NEXT_PUBLIC_GOOGLE_API_KEY  (or GOOGLE_API_KEY)
  NEXT_PUBLIC_CX              (or GOOGLE_CX / CX)
  HUGGINGFACE_API_KEY
  VARIATIONS_PER_SKU (optional, default=1)
  HF_MODEL_ID (optional, default="runwayml/stable-diffusion-v1-5")

Usage (PowerShell example):
  $env:NEXT_PUBLIC_GOOGLE_API_KEY="<key>"; \
  $env:NEXT_PUBLIC_CX="<cx>"; \
  $env:HUGGINGFACE_API_KEY="hf_xxx"; \
  python image-gen/google_hf_img2img.py

Outputs:
  image-gen/refs/    -> downloaded reference images (raw)
  image-gen/output/  -> generated catalog images (SKU.jpg)

CSV format (products.csv in same folder):
  sku,name,prompt,negative_prompt
"""
from __future__ import annotations
import os
import csv
import time
import base64
import mimetypes
import traceback
from pathlib import Path
from typing import Optional, Dict, Any
import requests

BASE_DIR = Path(__file__).parent
CSV_PATH = BASE_DIR / "products.csv"
REF_DIR = BASE_DIR / "refs"
OUT_DIR = BASE_DIR / "output"
REF_DIR.mkdir(exist_ok=True, parents=True)
OUT_DIR.mkdir(exist_ok=True, parents=True)

# ---- ENV / CONFIG ----
GOOGLE_KEY = (
    os.getenv("NEXT_PUBLIC_GOOGLE_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or os.getenv("GOOGLE_KEY")
)
GOOGLE_CX = (
    os.getenv("NEXT_PUBLIC_CX")
    or os.getenv("NEXT_PUBLIC_GOOGLE_CX")
    or os.getenv("GOOGLE_CX")
    or os.getenv("CX")
)
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_MODEL_ID = os.getenv("HF_MODEL_ID", "runwayml/stable-diffusion-v1-5")
VARIATIONS_PER_SKU = int(os.getenv("VARIATIONS_PER_SKU", "1"))
HOVER_DELAY = float(os.getenv("DELAY_BETWEEN_CALLS", "0.8"))  # polite pacing

GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"
HF_ENDPOINT = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"

if not GOOGLE_KEY or not GOOGLE_CX:
    print("[config error] Missing Google API key or CX. Set NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_CX.")
if not HF_API_KEY:
    print("[config error] Missing Hugging Face API key (HUGGINGFACE_API_KEY).")


# ---- HELPERS ----

def google_image_search(query: str) -> Optional[str]:
    """Return first image link for query using Google Custom Search API."""
    params = {
        "key": GOOGLE_KEY,
        "cx": GOOGLE_CX,
        "q": query,
        "searchType": "image",
        "num": 3,  # try a few for fallback
        "safe": "active",
    }
    try:
        r = requests.get(GOOGLE_ENDPOINT, params=params, timeout=25)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[google error] {query}: {e}")
        return None

    items = data.get("items") or []
    for item in items:
        link = item.get("link")
        if link:
            return link
    return None


def download_reference(url: str, sku: str) -> Optional[Path]:
    """Download reference image to refs/ and return path."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ".jpg"
        ref_path = REF_DIR / f"{sku}{ext}"
        with open(ref_path, "wb") as f:
            f.write(resp.content)
        return ref_path
    except Exception as e:
        print(f"[ref download fail] {url}: {e}")
        return None


def run_hf_img2img(ref_path: Path, prompt: str, negative: str, sku: str, variation_idx: int) -> Optional[Path]:
    """Send image + prompt to Hugging Face model (img2img-like)."""
    with open(ref_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload: Dict[str, Any] = {
        "inputs": img_b64,  # for some models "image" key may be required; adjust if needed
        "parameters": {
            "prompt": prompt,
            "negative_prompt": negative,
            "strength": 0.30,
            "num_inference_steps": 40,
            "guidance_scale": 7.5,
        },
        # Some models expect top-level prompt; we duplicate for broader compatibility
        "prompt": prompt,
    }

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    try:
        resp = requests.post(HF_ENDPOINT, headers=headers, json=payload, timeout=180)
    except Exception as e:
        print(f"[hf request error] {sku}: {e}")
        return None

    content_type = resp.headers.get("Content-Type", "")

    if content_type.startswith("application/json"):
        try:
            err_json = resp.json()
            print(f"[hf json response] {sku}: {err_json}")
        except Exception:
            print(f"[hf json parse fail] {sku}: status={resp.status_code}")
        return None

    if resp.status_code != 200:
        print(f"[hf error] {sku}: HTTP {resp.status_code}")
        return None

    out_name = f"{sku}_{variation_idx}.jpg" if VARIATIONS_PER_SKU > 1 else f"{sku}.jpg"
    out_path = OUT_DIR / out_name
    try:
        with open(out_path, "wb") as f:
            f.write(resp.content)
        print(f"[saved] {out_path}")
        return out_path
    except Exception as e:
        print(f"[save fail] {sku}: {e}")
        return None


def process_row(row: Dict[str, str]):
    sku = row.get("sku", "").strip()
    name = row.get("name", "").strip()
    prompt = row.get("prompt", "").strip()
    negative = row.get("negative_prompt", "").strip()
    if not sku or not name:
        print("[skip] missing sku or name")
        return

    print(f"\n=== SKU {sku}: {name} ===")
    query = f"{name} product photo"
    ref_url = google_image_search(query)
    if not ref_url:
        print(f"[no ref] {sku} - no image url found")
        return
    print(f"[ref url] {ref_url}")

    ref_path = download_reference(ref_url, sku)
    if not ref_path:
        print(f"[no ref file] {sku}")
        return

    for i in range(VARIATIONS_PER_SKU):
        run_hf_img2img(ref_path, prompt, negative, sku, i)
        time.sleep(HOVER_DELAY)


def main():
    if not CSV_PATH.exists():
        print(f"Missing CSV at {CSV_PATH}")
        return
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                process_row(row)
            except Exception as e:
                print(f"[row error] {row.get('sku')} {e}\n{traceback.format_exc()}")
                continue


if __name__ == "__main__":
    main()
