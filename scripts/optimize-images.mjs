import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const uploadsRoot = path.join(ROOT, "assets", "uploads");
const contentRoot = path.join(ROOT, "content", "el");
const rasterExts = new Set([".jpg", ".jpeg", ".png"]);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(startDir, matcher) {
  const output = [];
  const stack = [startDir];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (!matcher || matcher(fullPath)) {
        output.push(fullPath);
      }
    }
  }

  return output;
}

function toPublicPath(filePath) {
  return `/${path.relative(ROOT, filePath).split(path.sep).join("/")}`;
}

async function createWebpVariants() {
  const sourceImages = await walkFiles(
    uploadsRoot,
    (filePath) => rasterExts.has(path.extname(filePath).toLowerCase())
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const sourcePath of sourceImages) {
    const webpPath = sourcePath.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const sourceStat = await fs.stat(sourcePath);
    const hasWebp = await exists(webpPath);

    if (hasWebp) {
      const webpStat = await fs.stat(webpPath);
      if (webpStat.mtimeMs >= sourceStat.mtimeMs) {
        skipped += 1;
        continue;
      }
    }

    try {
      await sharp(sourcePath).webp({ quality: 82, effort: 5 }).toFile(webpPath);
      generated += 1;
    } catch {
      failed += 1;
    }
  }

  return { total: sourceImages.length, generated, skipped, failed };
}

function replaceImagePathWithWebp(value) {
  if (typeof value !== "string") return { value, changed: false };
  if (!value.startsWith("/assets/uploads/")) return { value, changed: false };
  if (!/\.(jpg|jpeg|png)$/i.test(value)) return { value, changed: false };

  const absoluteOriginal = path.join(ROOT, value.replace(/^\//, "").replace(/\//g, path.sep));
  const absoluteWebp = absoluteOriginal.replace(/\.(jpg|jpeg|png)$/i, ".webp");
  const publicWebp = value.replace(/\.(jpg|jpeg|png)$/i, ".webp");

  return { value: publicWebp, changed: absoluteWebp };
}

async function rewriteJsonWithWebpPaths() {
  const jsonFiles = await walkFiles(contentRoot, (filePath) => filePath.toLowerCase().endsWith(".json"));

  let filesUpdated = 0;
  let replacements = 0;

  async function transformNode(node) {
    if (Array.isArray(node)) {
      let changed = false;
      const mapped = [];
      for (const item of node) {
        const next = await transformNode(item);
        if (next.changed) changed = true;
        mapped.push(next.value);
      }
      return { value: mapped, changed };
    }

    if (node && typeof node === "object") {
      let changed = false;
      const nextObj = {};
      for (const [key, value] of Object.entries(node)) {
        const next = await transformNode(value);
        if (next.changed) changed = true;
        nextObj[key] = next.value;
      }
      return { value: nextObj, changed };
    }

    if (typeof node === "string") {
      const candidate = replaceImagePathWithWebp(node);
      if (!candidate.changed) return { value: node, changed: false };
      const hasWebp = await exists(candidate.changed);
      if (!hasWebp) return { value: node, changed: false };
      replacements += 1;
      return { value: candidate.value, changed: true };
    }

    return { value: node, changed: false };
  }

  for (const filePath of jsonFiles) {
    let raw = "";
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const transformed = await transformNode(parsed);
    if (!transformed.changed) continue;

    const pretty = `${JSON.stringify(transformed.value, null, 2)}\n`;
    await fs.writeFile(filePath, pretty, "utf8");
    filesUpdated += 1;
  }

  return { filesUpdated, replacements };
}

async function main() {
  const conversion = await createWebpVariants();
  const rewrite = await rewriteJsonWithWebpPaths();

  const report = {
    generatedAt: new Date().toISOString(),
    conversion,
    rewrite
  };

  const reportPath = path.join(ROOT, "assets", "uploads", "image-optimization-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Scanned images: ${conversion.total}`);
  console.log(`Generated webp: ${conversion.generated}`);
  console.log(`Skipped up-to-date: ${conversion.skipped}`);
  console.log(`Failed conversions: ${conversion.failed}`);
  console.log(`Updated JSON files: ${rewrite.filesUpdated}`);
  console.log(`Replaced image paths: ${rewrite.replacements}`);
  console.log(`Report: ${toPublicPath(reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
