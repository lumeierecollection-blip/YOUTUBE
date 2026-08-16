#!/usr/bin/env python3
"""
rembg_remove.py — thin CLI wrapper around rembg's Python API (rembg[cpu]).

Not the rembg CLI (that needs the separate [cli] extra with click) — this
repo installs the plain library into a dedicated venv (.venv-rembg/, see
src/skills/asset-sourcing/treat.js) and calls it directly.

Usage: python3 rembg_remove.py <input> <output.png> [--matting]

--matting enables rembg's alpha-matting post-process for a softer, more
accurate edge on hairy/fine subjects (fur, hair, spider legs). It roughly
doubles run time; treat.js enables it only for cutout-mode assets, not for
the full-bleed classification pass.
"""
import sys

def main():
    args = sys.argv[1:]
    matting = "--matting" in args
    args = [a for a in args if a != "--matting"]
    if len(args) != 2:
        print("usage: rembg_remove.py <input> <output.png> [--matting]", file=sys.stderr)
        sys.exit(2)
    src, dst = args

    from rembg import remove, new_session
    from PIL import Image

    session = new_session("u2net")
    im = Image.open(src)
    im = im.convert("RGB")
    kwargs = dict(session=session)
    if matting:
        kwargs.update(
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )
    out = remove(im, **kwargs)
    out.save(dst)
    print(f"{dst} {out.size[0]}x{out.size[1]}")

if __name__ == "__main__":
    main()
