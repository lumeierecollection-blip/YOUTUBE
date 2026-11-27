// Encrypts and decrypts the third-party footage clips of a Rival Lines "realm" episode.
// usage: node footage-crypt.mjs enc <dir_with_mp4>        -> writes <name>.mp4.enc next to each .mp4
//        node footage-crypt.mjs dec <dir_with_mp4.enc>    -> writes <name>.mp4 next to each .mp4.enc
// The key is the CLIP_KEY environment variable (a GitHub secret in CI, a file outside the repo locally). The repo is public and the
// clips belong to other people, so only the encrypted files are committed; the .mp4 copies are gitignored. AES-256-GCM, file layout
// is 12 bytes iv, 16 bytes tag, then the ciphertext. This keeps the clips out of casual reach; it is not a licence to use them.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [mode, dir] = process.argv.slice(2);
const secret = process.env.CLIP_KEY;
if (!secret) { console.error("CLIP_KEY is not set"); process.exit(2); }
if (!["enc", "dec"].includes(mode) || !dir) { console.error("usage: footage-crypt.mjs enc|dec <dir>"); process.exit(2); }
const key = crypto.createHash("sha256").update(secret).digest();

let n = 0;
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  if (mode === "enc" && f.endsWith(".mp4")) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([c.update(fs.readFileSync(p)), c.final()]);
    fs.writeFileSync(`${p}.enc`, Buffer.concat([iv, c.getAuthTag(), body]));
    n++;
  } else if (mode === "dec" && f.endsWith(".mp4.enc")) {
    const raw = fs.readFileSync(p);
    const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    fs.writeFileSync(p.slice(0, -4), Buffer.concat([d.update(raw.subarray(28)), d.final()]));
    n++;
  }
}
console.log(`${mode}: ${n} file(s) in ${dir}`);
