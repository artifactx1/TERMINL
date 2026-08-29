/**
 * Publishes the snapshot's images to Google Cloud Storage.
 *
 * The site works without this — `public/art` is committed as the fallback — but
 * serving from the bucket keeps the images out of the deployment and next to
 * the rest of the ELEMENT media.
 *
 * Credentials are never stored in this repo. Point Node at the server's env
 * file for the run and nothing is copied anywhere:
 *
 *   node --env-file=../ElementServer/.env scripts/upload-art.mjs
 *   node --env-file=../ElementServer/.env scripts/upload-art.mjs --check
 *
 * `--check` verifies bucket access and reports what would change, without
 * writing anything.
 */
import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

const BUCKET = process.env.GCS_BUCKET_NAME || "curent-marketplace";
const PREFIX = process.env.TERMINL_ART_PREFIX || "terminl/art";
const LOCAL = path.join("public", "art");
const DEGENS = path.join("public", "degens");
const CHECK = process.argv.includes("--check");

/** Matches how ElementServer loads the same credential: raw JSON or base64. */
function credentials() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

async function main() {
  const creds = credentials();
  const storage = creds
    ? new Storage({ projectId: process.env.GCS_PROJECT_ID || creds.project_id, credentials: creds })
    : new Storage({ projectId: process.env.GCS_PROJECT_ID });

  const bucket = storage.bucket(BUCKET);
  const files = fs.readdirSync(LOCAL).filter((f) => f.endsWith(".webp")).sort();
  if (!files.length) throw new Error(`No images in ${LOCAL}. Run "npm run snapshot" first.`);

  /*
   * The share card ships too. It has to live on an absolute, stable URL —
   * scrapers resolve og:image before the site has a domain, and a Vercel
   * preview URL changes on every deploy.
   */
  const extras = fs.existsSync("public/og.jpg")
    ? [{ local: "public/og.jpg", object: `${path.dirname(PREFIX)}/og.jpg`, type: "image/jpeg" }]
    : [];

  // Cast portraits sit beside the art under the same prefix root.
  if (fs.existsSync(DEGENS)) {
    for (const name of fs.readdirSync(DEGENS).filter((f) => f.endsWith(".webp")).sort()) {
      extras.push({
        local: path.join(DEGENS, name),
        object: `${path.dirname(PREFIX)}/degens/${name}`,
        type: "image/webp",
      });
    }
  }

  console.log(`bucket   gs://${BUCKET}/${PREFIX}`);
  console.log(`local    ${files.length} images in ${LOCAL}\n`);

  if (CHECK) {
    /*
     * Deliberately no bucket.exists() here: the service account is scoped to
     * roles/storage.objectAdmin on this bucket, which grants object operations
     * but not storage.buckets.get. Probing an object is both sufficient and
     * within the grant.
     */
    for (const name of files) {
      const [there] = await bucket.file(`${PREFIX}/${name}`).exists();
      console.log(`  ${there ? "present" : "MISSING"}  ${name}`);
    }
    for (const e of extras) {
      const [there] = await bucket.file(e.object).exists();
      console.log(`  ${there ? "present" : "MISSING"}  ${e.object}`);
    }
    console.log("\n--check only, nothing written");
    return;
  }

  for (const name of files) {
    const object = `${PREFIX}/${name}`;
    await bucket.upload(path.join(LOCAL, name), {
      destination: object,
      resumable: false,
      metadata: {
        contentType: "image/webp",
        // Slugs are content-addressed by token, so a given object never changes.
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    console.log(`  uploaded  ${object}`);
  }

  for (const e of extras) {
    await bucket.upload(e.local, {
      destination: e.object,
      resumable: false,
      // The card changes when the showcase does, so it must not be cached forever.
      metadata: {
        contentType: e.type,
        // The card changes with the showcase; the portraits do not.
        cacheControl: e.local.endsWith("og.jpg")
          ? "public, max-age=3600"
          : "public, max-age=31536000, immutable",
      },
    });
    console.log(`  uploaded  ${e.object}`);
  }

  console.log(`\nSet this on Vercel and locally:\n  NEXT_PUBLIC_ART_BASE_URL=https://storage.googleapis.com/${BUCKET}/${PREFIX}`);
}

main().catch((e) => {
  console.error(`upload failed: ${e.message}`);
  process.exit(1);
});
