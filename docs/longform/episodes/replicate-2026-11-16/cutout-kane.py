"""Cut a player out of a licensed photo (OpenCV only, no model download).
Photo: File:FWC 2018 - Round of 16 - COL v ENG - Photo 098.jpg (Voltmetro, CC BY-SA 4.0, via Wikimedia Commons); Harry Kane before his penalty in the Colombia v England shoot-out.
Pass 1 half-resolution GrabCut + colour rules, pass 2 full-resolution GrabCut from a trimap, edge despill, specks removed, one connected piece.
Usage: python cutout-kane.py <photo.jpg> <out.png>"""
import sys, cv2, numpy as np
src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src); H, W = img.shape[:2]
b, g, r = [img[:, :, i].astype(int) for i in range(3)]
s = 0.5; small = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA); h, w = small.shape[:2]
mk = np.full((h, w), cv2.GC_PR_BGD, np.uint8); mk[:, :int(w * 0.44)] = cv2.GC_BGD; mk[:, int(w * 0.9):] = cv2.GC_BGD
mk[:, int(w * 0.52):int(w * 0.84)] = cv2.GC_PR_FGD; mk[int(h * 0.25):int(h * 0.95), int(w * 0.58):int(w * 0.77)] = cv2.GC_FGD
cv2.grabCut(small, mk, None, np.zeros((1, 65)), np.zeros((1, 65)), 5, cv2.GC_INIT_WITH_MASK)
m = np.where((mk == cv2.GC_FGD) | (mk == cv2.GC_PR_FGD), 255, 0).astype(np.uint8); m = cv2.resize(m, (W, H), interpolation=cv2.INTER_NEAREST)
blue = ((b > r + 60) & (b > 140) & (r < 110)).astype(np.uint8)
prot = np.zeros(blue.shape, bool)
m[(g > r + 6) & (g > b + 6) & ~prot] = 0                                    # grass
hair = (r < 150) & (g < 115) & (b < 95) & (r > b + 8); skin = (r > 150) & (g > 95) & (b > 70) & (r > g + 12)
top = np.zeros_like(m, bool); top[:int(H * 0.17), :] = True; m[top & ~(hair | skin)] = 0
m[(r > 170) & (g > 150) & (b < 90)] = 0
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((11, 11), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((17, 17), np.uint8))
def largest(x):
    n, lab, st, _ = cv2.connectedComponentsWithStats(x); k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); return np.where(lab == k, 255, 0).astype(np.uint8)
def fill_inner_holes(x):
    inv = cv2.bitwise_not(x); n, lab, st, _ = cv2.connectedComponentsWithStats(inv); hh, ww = x.shape
    for i in range(1, n):
        a, c, d, e, _ = st[i]
        if a > 0 and c > 0 and a + d < ww and c + e < hh: x[lab == i] = 255
    return x
m = fill_inner_holes(largest(m))
ys, xs = np.where(m > 0); x0, x1 = max(0, xs.min() - 60), min(W, xs.max() + 60)
crop = img[:, x0:x1].copy(); mc = m[:, x0:x1]; ker = np.ones((3, 3), np.uint8)
tri = np.full(mc.shape, cv2.GC_PR_BGD, np.uint8); tri[mc > 0] = cv2.GC_PR_FGD
tri[cv2.erode(mc, ker, iterations=9) > 0] = cv2.GC_FGD; tri[cv2.bitwise_not(cv2.dilate(mc, ker, iterations=9)) > 0] = cv2.GC_BGD
cv2.grabCut(crop, tri, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)
m2 = np.where((tri == cv2.GC_FGD) | (tri == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
cb, cg, cr = [crop[:, :, i].astype(int) for i in range(3)]
m2_raw = m2.copy()
m2[(cg > cr + 6) & (cg > cb + 6)] = 0
# put the green badge back: it sits directly above the blue armband, inside the band's width
bl = blue[:, x0:x1]; nB, labB, stB, _ = cv2.connectedComponentsWithStats(bl); kB = 1 + np.argmax(stB[1:, cv2.CC_STAT_AREA]); bx, by, bw, bh = stB[kB][:4]
box = (slice(max(0, by - 80), by + 6), slice(bx - 4, bx + bw + 4)); m2[box] = np.maximum(m2[box], m2_raw[box])
# smear above the hair (flag / banner): green-yellow tint in the top 8% goes
gy = (cg > cr - 5); m2[:int(H * 0.08)][gy[:int(H * 0.08)]] = 0
m2 = cv2.morphologyEx(m2, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)); m2 = cv2.morphologyEx(m2, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
m2 = fill_inner_holes(largest(m2)); m2 = cv2.erode(m2, ker, iterations=1)
m2[:int(H * 0.012), :] = 0                                                 # fragment of banner above the hair
band = slice(int(H * 0.115), int(H * 0.23)); op = cv2.morphologyEx(m2[band], cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
m2[band] = np.minimum(m2[band], cv2.dilate(op, ker))                         # specks around the neck
m2 = fill_inner_holes(largest(m2))
alpha = cv2.GaussianBlur(m2, (0, 0), 1.2)
edge = (cv2.dilate(m2, ker, iterations=5) > 0) & (cv2.erode(m2, ker, iterations=5) == 0)
c = crop.astype(np.float32); lim = np.maximum(c[:, :, 0], c[:, :, 2]); spill = edge & (c[:, :, 1] > lim); c[:, :, 1] = np.where(spill, lim, c[:, :, 1])
out = np.dstack([np.clip(c, 0, 255).astype(np.uint8), alpha])
ys, xs = np.where(alpha > 30); out = out[max(0, ys.min() - 3):ys.max() + 3, max(0, xs.min() - 6):xs.max() + 6]
cv2.imwrite(dst, out); print(out.shape)
