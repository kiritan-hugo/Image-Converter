// src/scripts/imageProcessor.js
import libheif from 'libheif-js';
import * as webpEncoder from '@jsquash/webp';
import * as avifEncoder from '@jsquash/avif';

// iOS/Safari判定（モジュールスコープで一度だけ評価）
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const needsWasmEncoder = isIOS || isSafari;

export async function resizeImage(file, config) {
  const { targetWidth, format, quality } = config;
  let sourceElement;

  // 1. HEICデコード
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    const buffer = await file.arrayBuffer();
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(buffer);
    if (!data || data.length === 0) throw new Error("HEIC decode failed");

    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    const imageData = await new Promise((resolve, reject) => {
      image.display(
        { data: new Uint8ClampedArray(width * height * 4), width, height },
        (displayData) => {
          if (!displayData) return reject(new Error("Display mapping failed"));
          resolve(new ImageData(displayData.data, width, height));
        }
      );
    });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
    sourceElement = tempCanvas;
  } else {
    sourceElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = URL.createObjectURL(file);
    });
  }

  // 2. リサイズ
  const pica = window.pica();
  const originWidth = sourceElement.width || sourceElement.naturalWidth;
  const originHeight = sourceElement.height || sourceElement.naturalHeight;
  const finalWidth = targetWidth || originWidth;
  const finalHeight = Math.round((originHeight / originWidth) * finalWidth);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = finalWidth;
  outCanvas.height = finalHeight;

  await pica.resize(sourceElement, outCanvas, {
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  if (sourceElement instanceof Image && sourceElement.src.startsWith('blob:')) {
    URL.revokeObjectURL(sourceElement.src);
  }

  // 3. エンコード
  const qualityInt = Math.round(quality * 100);
  const avifQuantizer = Math.round((1 - quality) * 55);
  const ctx = outCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);

  // WebP: iOS/SafariはWasm経由、それ以外はtoBlob
  if (format === 'image/webp') {
    if (needsWasmEncoder) {
      const buf = await webpEncoder.encode(imageData, { quality: qualityInt });
      return new Blob([buf], { type: 'image/webp' });
    }
    return canvasToBlob(outCanvas, 'image/webp', quality);
  }

  // AVIF: 全環境でWasm経由（toBlob対応ブラウザがまだ少ないため）
 if (format === 'image/avif') {
  const buf = await avifEncoder.encode(imageData, {
    cqLevel: avifQuantizer, // quantizerではなくcqLevelが正しいパラメーター名
    cqAlphaLevel: -1,       // アルファチャンネルは自動
    speed: 6,               // 0(最高圧縮・遅い) 〜 10(最低圧縮・速い) 開発時は6が現実的
  });
  return new Blob([buf], { type: 'image/avif' });
  }

  // JPEG/PNG: 通常のtoBlob
  return canvasToBlob(outCanvas, format, quality);
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")),
      format,
      quality
    );
  });
}