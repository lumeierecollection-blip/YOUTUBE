#!/usr/bin/env python3
"""Count the planner prompt in Gemini tokens with Google's OFFLINE tokenizer (google-genai LocalTokenizer).

usage: count-tokens-local.py --budget 4500 --out out/tokens/tokens.json  label=dir [label=dir ...]
       each dir holds prompt-text.txt and prompt-text-with-note.txt (scripts/measure-planner-prompt.mjs).

No API key and no request to the Gemini API: LocalTokenizer downloads a public tokenizer file once and counts locally.
It counts TEXT only. It cannot count the reference frames the planner attaches to each call, so the number it prints is
the text share of the prompt, never the provider-billed total. The first label is judged against --budget.

The budget applies to the complete provider request including the reference frames (owner decision), so a text-only
count can disprove it but never prove it. Exit codes: 1 text alone is over budget (the full request certainly is);
3 NOT MEASURED (tokenizer unavailable or unsupported for a model); 4 BLOCKED (text within budget, complete request
unmeasured). There is no exit 0: this script cannot pass the budget.
"""
import argparse
import json
import sys

MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"]  # the models src/lib/gemini-client.js sends the planner to


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("targets", nargs="+")
    a = ap.parse_args()
    targets = [t.split("=", 1) for t in a.targets]
    first_label = targets[0][0]

    try:
        try:
            from google.genai import LocalTokenizer
        except ImportError:
            from google.genai.local_tokenizer import LocalTokenizer
    except Exception as e:  # noqa: BLE001
        print(f"NOT MEASURED: google-genai LocalTokenizer is not importable ({type(e).__name__}: {e})")
        json.dump({"measured": False, "reason": "import failed"}, open(a.out, "w"), indent=2)
        return 3

    result = {"measured": True, "budget": a.budget, "text_only": True, "counts": {}, "errors": {}}
    for model in MODELS:
        try:
            tok = LocalTokenizer(model_name=model)
        except Exception as e:  # noqa: BLE001
            result["errors"][model] = f"{type(e).__name__}: {e}"
            continue
        for label, d in targets:
            for name in ("prompt-text", "prompt-text-with-note"):
                text = open(f"{d}/{name}.txt", encoding="utf-8").read()
                try:
                    n = tok.count_tokens(text).total_tokens
                except Exception as e:  # noqa: BLE001
                    result["errors"][f"{model}/{label}/{name}"] = f"{type(e).__name__}: {e}"
                    continue
                result["counts"].setdefault(model, {}).setdefault(label, {})[name] = n

    over, unmeasured = [], []
    for model in MODELS:
        n = result["counts"].get(model, {}).get(first_label, {}).get("prompt-text-with-note")
        if n is None:
            unmeasured.append(model)
        elif n >= a.budget:
            over.append((model, n))
    result["over_budget"] = [{"model": m, "tokens": n} for m, n in over]
    result["unmeasured_models"] = unmeasured
    json.dump(result, open(a.out, "w"), indent=2)

    for model, per in result["counts"].items():
        for label, v in per.items():
            print(f"{model:24s} {label:8s} text={v.get('prompt-text')}  text+note={v.get('prompt-text-with-note')}  (budget {a.budget}, text only)")
    for k, v in result["errors"].items():
        print(f"ERROR {k}: {v}")
    if unmeasured:
        print(f"NOT MEASURED for: {', '.join(unmeasured)} - this is not a pass")
        return 3
    if over:
        print("OVER BUDGET: " + ", ".join(f"{m}={n}" for m, n in over))
        return 1
    print(f"BLOCKED: text-only count is within budget ({first_label}), but the budget applies to the COMPLETE request including the reference frames, "
          "which this offline count cannot see. The complete-request budget is NOT VERIFIED; this is not a pass.")
    return 4


if __name__ == "__main__":
    sys.exit(main())
