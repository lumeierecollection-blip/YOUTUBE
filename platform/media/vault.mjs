#!/usr/bin/env node
/**
 * Media vault: third-party media the owner chose to use (match clips, background music) is kept in this PUBLIC repo only as AES-256-GCM
 * ciphertext (data/vault/<name>.enc). The key lives in the Actions secret MEDIA_KEY and, on the owner's PC, in ~/.youtube-media/MEDIA_KEY;
 * it is never committed. Renders decrypt into the Remotion public dir at run time.
 *   node platform/media/vault.mjs seal <file> <name>          -> data/vault/<name>.enc   (PC)
 *   node platform/media/vault.mjs open <name> <out-file>       -> plaintext               (CI or PC)
 *   node platform/media/vault.mjs open-all <dir> [prefix]      -> every vault file (optionally only names starting with prefix) into <dir>
 * Key: env MEDIA_KEY, else ~/.youtube-media/MEDIA_KEY.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), VAULT = join(ROOT, "data/vault");
const keyText = process.env.MEDIA_KEY || (existsSync(join(homedir(), ".youtube-media/MEDIA_KEY")) ? readFileSync(join(homedir(), ".youtube-media/MEDIA_KEY"), "utf8").trim() : "");
if (!keyText) { console.error("no MEDIA_KEY (env or ~/.youtube-media/MEDIA_KEY): vault media skipped"); process.exit(process.argv[2] === "open-all" ? 0 : 1); }
const KEY = createHash("sha256").update(keyText).digest();

const seal = (buf) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", KEY, iv), body = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]); };
const open = (buf) => { const d = createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28)); return Buffer.concat([d.update(buf.subarray(28)), d.final()]); };

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "seal") { mkdirSync(VAULT, { recursive: true }); writeFileSync(join(VAULT, `${b}.enc`), seal(readFileSync(a))); console.log(`sealed ${a} -> data/vault/${b}.enc`); }
else if (cmd === "open") { mkdirSync(dirname(b), { recursive: true }); writeFileSync(b, open(readFileSync(join(VAULT, `${a}.enc`)))); console.log(`opened ${a} -> ${b}`); }
else if (cmd === "open-all") { mkdirSync(a, { recursive: true }); let n = 0; for (const f of existsSync(VAULT) ? readdirSync(VAULT) : []) { if (!f.endsWith(".enc") || (b && !f.startsWith(b))) continue; writeFileSync(join(a, f.slice(0, -4)), open(readFileSync(join(VAULT, f)))); n++; } console.log(`opened ${n} vault files into ${a}`); }
else { console.error("usage: seal <file> <name> | open <name> <out> | open-all <dir> [prefix]"); process.exit(1); }
