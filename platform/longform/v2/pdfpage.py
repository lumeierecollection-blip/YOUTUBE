# Long form v2: renders real pages of a PDF (a court document) to PNG and reports the rectangles of given phrases on the page pixels, so a
# highlight is drawn on the real document. Court & Spotlight: document presentation and evidence highlighting.
# Usage: python platform/longform/v2/pdfpage.py <file.pdf> <outDir> <id> <scale> <page:phrase> [<page:phrase> ...]   (page numbers start at 1)
import json, os, re, sys
import pypdfium2 as pdfium

pdf_path, out_dir, ident, scale = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
wants = [(int(a.split(":", 1)[0]), a.split(":", 1)[1]) for a in sys.argv[5:]]
os.makedirs(out_dir, exist_ok=True)
pdf = pdfium.PdfDocument(pdf_path)
out = {"id": ident, "pdf": os.path.basename(pdf_path), "pages": {}, "rects": {}}
for pno in sorted(set(p for p, _ in wants)):
    page = pdf[pno - 1]
    w, h = page.get_size()
    img = page.render(scale=scale).to_pil()
    name = f"{ident}-p{pno}.png"
    img.save(os.path.join(out_dir, name))
    out["pages"][pno] = {"file": name, "w": img.width, "h": img.height}
    tp = page.get_textpage()
    full = tp.get_text_range()
    for _, phrase in [x for x in wants if x[0] == pno]:
        # tolerant search: the PDF breaks lines inside sentences, so match with any whitespace between words
        pat = re.compile(r"\s+".join(re.escape(tok) for tok in phrase.split()), re.I)
        m = pat.search(full)
        if not m:
            out["rects"][phrase] = None
            continue
        n = tp.count_rects(m.start(), m.end() - m.start())
        rects = []
        for i in range(n):
            l, b, r, t = tp.get_rect(i)
            rects.append({"page": pno, "x": round(l * scale), "y": round((h - t) * scale), "w": round((r - l) * scale), "h": round((t - b) * scale)})
        out["rects"][phrase] = rects
json.dump(out, open(os.path.join(out_dir, ident + ".json"), "w"), indent=1)
print(ident, {k: (len(v) if v else "MISSING") for k, v in out["rects"].items()})
