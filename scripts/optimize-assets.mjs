#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve('src/assets');
const OPTIMIZED_DIR = path.resolve('src/assets/images/optimized');
const TARGET_WIDTHS = [400, 800, 1200, 1672];
const RAW_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp']);

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return [fullPath];
  });
}

function getDimensions(filePath) {
  const output = execFileSync('identify', ['-format', '%w %h', filePath], {
    encoding: 'utf-8',
  }).trim();
  const [w, h] = output.split(/\s+/).map(Number);
  return { width: w || 1200, height: h || 1200 };
}

function encodeVariant(srcPath, destPath, width, quality) {
  execFileSync(
    'convert',
    [
      srcPath,
      '-auto-orient',
      '-strip',
      '-colorspace',
      'sRGB',
      '-resize',
      `${width}x>`,
      '-quality',
      String(quality),
      destPath,
    ],
    { stdio: 'pipe' }
  );
}

function run() {
  fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
  const allFiles = walkFiles(ASSETS_DIR);
  const rawSources = allFiles.filter((file) =>
    RAW_EXTENSIONS.has(path.extname(file).toLowerCase())
  );

  for (const srcPath of rawSources) {
    const baseName = path.basename(srcPath, path.extname(srcPath));
    const { width: naturalWidth } = getDimensions(srcPath);
    const widths = Array.from(
      new Set([
        ...TARGET_WIDTHS.filter((w) => w < naturalWidth),
        Math.min(naturalWidth, 1672),
      ])
    ).sort((a, b) => a - b);

    for (const width of widths) {
      const avifQuality = width <= 400 ? 48 : width <= 800 ? 54 : 58;
      const webpQuality = width <= 400 ? 74 : width <= 800 ? 80 : 84;
      const avifOut = path.join(OPTIMIZED_DIR, `${baseName}-${width}w.avif`);
      const webpOut = path.join(OPTIMIZED_DIR, `${baseName}-${width}w.webp`);
      encodeVariant(srcPath, avifOut, width, avifQuality);
      encodeVariant(srcPath, webpOut, width, webpQuality);
    }

    fs.rmSync(srcPath);
    console.log(`Converted and cleaned raw source: ${path.relative(process.cwd(), srcPath)}`);
  }

  const optimizedFiles = walkFiles(OPTIMIZED_DIR);
  const avifFiles = optimizedFiles.filter((f) => f.endsWith('.avif'));
  const webpFiles = optimizedFiles.filter((f) => f.endsWith('.webp'));
  const avifBytes = avifFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);
  const webpBytes = webpFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

  console.log(
    JSON.stringify(
      {
        assetsDir: 'src/assets',
        rawFilesRemaining: walkFiles(ASSETS_DIR).filter((f) =>
          RAW_EXTENSIONS.has(path.extname(f).toLowerCase())
        ).length,
        avifCount: avifFiles.length,
        webpCount: webpFiles.length,
        avifTotalKB: Number((avifBytes / 1024).toFixed(1)),
        webpTotalKB: Number((webpBytes / 1024).toFixed(1)),
      },
      null,
      2
    )
  );
}

run();
