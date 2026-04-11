// src/scripts/imageProcessor.js
// libheif-js はそのまま使用
import libheif from 'libheif-js';

export async function resizeImage(file, config) {
  const { targetWidth, format, quality } = config;
  let sourceElement; // Canvas または ImageBitmap

  // 1. HEICデコード処理
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    const buffer = await file.arrayBuffer();
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(buffer);
    if (!data || data.length === 0) throw new Error("HEIC decode failed");
    
    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    // ImageDataを作成
    const imageData = await new Promise((resolve, reject) => {
      image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (displayData) => {
        if (!displayData) return reject(new Error("Display mapping failed"));
        resolve(new ImageData(displayData.data, width, height));
      });
    });

    // Picaに渡すために一度Canvasに描画
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
    sourceElement = tempCanvas;
  } else {
    // HEIC以外はImageオブジェクトとして読み込む
    sourceElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = URL.createObjectURL(file);
    });
  }

  // 2. リサイズ計算とPicaの実行
  return new Promise(async (resolve, reject) => {
    try {
      const pica = window.pica();
      const originWidth = sourceElement.width || sourceElement.naturalWidth;
      const originHeight = sourceElement.height || sourceElement.naturalHeight;

      const finalWidth = targetWidth || originWidth;
      const finalHeight = (originHeight / originWidth) * finalWidth;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = finalWidth;
      outCanvas.height = finalHeight;

      // Picaで高品質リサイズを実行
      await pica.resize(sourceElement, outCanvas, {
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2
      });

      // 3. iPhoneのWebP品質バグ回避ロジック
      let outputFormat = format;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      // iPhone/SafariでWebPが指定された場合、品質が効かず巨大化するためJPEGに逃がす
      if ((isIOS || isSafari) && outputFormat === "image/webp") {
        console.warn("iOS/Safari detected: Switching WebP to JPEG to fix compression bug.");
        outputFormat = "image/jpeg";
      }

      // 4. Blob生成
      outCanvas.toBlob((blob) => {
        // オブジェクトURLの解放（HEIC以外の場合）
        if (sourceElement instanceof Image && sourceElement.src.startsWith('blob:')) {
          URL.revokeObjectURL(sourceElement.src);
        }
        resolve(blob);
      }, outputFormat, quality);

    } catch (err) {
      reject(err);
    }
  });
}