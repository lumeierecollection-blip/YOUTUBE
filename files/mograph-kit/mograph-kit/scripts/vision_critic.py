#!/usr/bin/env python3
"""
vision_critic.py — ONE vision call per iteration, on ONE contact sheet.

This is the only step in the pipeline that costs money, so it is deliberately
constrained: one image in, structured JSON out, no conversation, no retries
beyond a single reformat attempt.

IMPORTANT: most free OpenCode Zen models have no vision support. If the
configured model cannot see images, this script exits non-zero rather than
returning a hallucinated critique. Do not work around that by guessing.

Env:
  VISION_API_BASE   default https://opencode.ai/zen/v1   (OpenAI-compatible)
  VISION_API_KEY    required
  VISION_MODEL      required, must be vision-capable

Usage:
  python scripts/vision_critic.py --sheet qa/sheet.jpg --out qa/critique.json \
      [--context qa/report.json]
"""

import argparse, base64, json, os, sys, urllib.request

PROMPT = """You are a motion graphics art director reviewing a contact sheet.
The 12 tiles are consecutive samples from one shot, left to right, top to bottom.

Answer ONLY with JSON matching this shape, no prose, no markdown fences:

{
  "worst_problem": "<one sentence, the single biggest visual failure>",
  "element": "<which element, identified by position and visible content>",
  "fix": "<a concrete change containing at least one number: frame count, pixel value, percentage, or a named easing curve>",
  "second_problem": "<one sentence or empty string>",
  "verdict": "ship" | "fix"
}

Judge only: alignment to a grid, visual hierarchy (is there one clear dominant
element), spacing consistency, contrast, and whether the frames read as a
designed sequence or as unrelated slides. Do not comment on the writing or the
topic. Never answer with adjectives alone — every fix must contain a number."""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", required=True)
    ap.add_argument("--out", default="qa/critique.json")
    ap.add_argument("--context", help="optional qa/report.json to include as text")
    args = ap.parse_args()

    base = os.environ.get("VISION_API_BASE", "https://opencode.ai/zen/v1").rstrip("/")
    key = os.environ.get("VISION_API_KEY")
    model = os.environ.get("VISION_MODEL")
    if not key or not model:
        sys.exit("VISION_API_KEY and VISION_MODEL must be set to a vision-capable model. "
                 "Most free Zen models cannot see images — do not fake this step.")

    with open(args.sheet, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode()

    text = PROMPT
    if args.context and os.path.exists(args.context):
        with open(args.context) as fh:
            rep = json.load(fh)
        text += ("\n\nA deterministic checker already found these, do not repeat them:\n"
                 + json.dumps(rep.get("summary", {})))

    body = {
        "model": model,
        "max_tokens": 400,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]}],
    }

    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except Exception as e:
        sys.exit(f"vision call failed: {e}")

    raw = data["choices"][0]["message"]["content"].strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        critique = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(f"model did not return JSON — it may not support vision.\n{raw[:400]}")

    if not any(ch.isdigit() for ch in str(critique.get("fix", ""))):
        critique["_warning"] = "fix contains no number; treat as unusable and re-ask once"

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as fh:
        json.dump(critique, fh, indent=2)
    print(json.dumps(critique, indent=2))
    sys.exit(0 if critique.get("verdict") == "ship" else 1)


if __name__ == "__main__":
    main()
