import os
import csv
import time
import requests
from pathlib import Path
from typing import Optional

# -------------- CONFIG --------------
BING_KEY = os.environ.get("BING_KEY", "YOUR_BING_KEY")
OPENART_API_KEY = os.environ.get("OPENART_API_KEY", "YOUR_OPENART_KEY")
INPUT_FILE = Path(__file__).parent / "products.csv"
OUT_DIR = Path(__file__).parent / "output"
OUT_DIR.mkdir(parents=True, exist_ok=True)
REF_DIR = Path(__file__).parent / "refs"
REF_DIR.mkdir(parents=True, exist_ok=True)
VARIATIONS_PER_SKU = int(os.environ.get("VARIATIONS_PER_SKU", 1))  # allow multiple generations per sku

# -------------- HELPERS --------------

def fetch_reference_image(query: str) -> Optional[Path]:
    """Fetch first suitable image from Bing Image Search, save locally, return path."""
    url = "https://api.bing.microsoft.com/v7.0/images/search"
    headers = {"Ocp-Apim-Subscription-Key": BING_KEY}
    params = {
        "q": query,
        "count": 6,
        "imageType": "Photo",
        "safeSearch": "Moderate",
    }
    try:
        r = requests.get(url, headers=headers, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[search error] {query}: {e}")
        return None

    for item in data.get("value", []):
        content_url = item.get("contentUrl")
        if not content_url:
            continue
        # Try downloading
        try:
            img_bytes = requests.get(content_url, timeout=25).content
            ext = ".jpg"
            ref_path = REF_DIR / (query.replace(" ", "_")[:60] + ext)
            with open(ref_path, "wb") as f:
                f.write(img_bytes)
            return ref_path
        except Exception as e:
            print(f"[download fail] {content_url}: {e}
Trying next candidate...")
            continue
    return None


def upload_reference_if_needed(path: Path) -> Optional[str]:
    """Placeholder: If OpenArt requires an uploaded asset, implement here.
    Currently returns local path or could upload to storage (S3, etc.)."""
    # For now we assume API can take a URL; if not, user must pre-host.
    # You could integrate an S3 upload here and return the public URL.
    return path.as_posix()


def run_openart_img2img(image_ref: str, prompt: str, negative_prompt: str, sku: str, variation_idx: int = 0) -> Optional[Path]:
    """Call OpenArt img2img endpoint and save result."""
    endpoint = "https://api.openart.ai/v1/img2img"
    headers = {"Authorization": f"Bearer {OPENART_API_KEY}"}
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "image": image_ref,  # depending on API this may need to be a URL
        "strength": 0.35,
        "width": 1024,
        "height": 1024,
        "num_inference_steps": 40,
        "guidance_scale": 7.5,
    }
    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[openart error] {sku}: {e}\nResponse: {getattr(e, 'response', None)}")
        return None

    output_list = data.get("output") or data.get("images") or []
    if not output_list:
        print(f"[openart warning] no output for {sku}")
        return None

    img_url = output_list[0]
    try:
        img_bytes = requests.get(img_url, timeout=60).content
        out_name = f"{sku}_{variation_idx}.jpg" if VARIATIONS_PER_SKU > 1 else f"{sku}.jpg"
        out_path = OUT_DIR / out_name
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"[saved] {out_path}")
        return out_path
    except Exception as e:
        print(f"[download result fail] {img_url}: {e}")
        return None


def process_sku(row: dict):
    sku = row["sku"].strip()
    name = row["name"].strip()
    prompt = row.get("prompt", "").strip()
    neg = row.get("negative_prompt", "").strip()

    print(f"\n=== Processing {sku}: {name} ===")
    query = f"{name} product photo"

    ref_local = fetch_reference_image(query)
    if not ref_local:
        print(f"No reference image found for {sku}, skipping.")
        return

    image_ref = upload_reference_if_needed(ref_local)

    for i in range(VARIATIONS_PER_SKU):
        run_openart_img2img(image_ref, prompt, neg, sku, i)
        # Small delay to be polite to API
        time.sleep(1)


def main():
    if not INPUT_FILE.exists():
        print(f"Missing CSV: {INPUT_FILE}")
        return
    with open(INPUT_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            process_sku(row)


if __name__ == "__main__":
    main()
