// src/scripts/imageProcessor.js
import libheif from 'libheif-js';

export async function resizeImage(file, config) {
  const { targetWidth, format, quality } = config;
  let processingData;

  // HEICデコード処理 (前回と同じ)
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    try {
      const buffer = await file.arrayBuffer();
      const decoder = new libheif.HeifDecoder();
      const data = decoder.decode(buffer);
      if (!data || data.length === 0) throw new Error("HEIC decode failed");
      
      const image = data[0];
      const width = image.get_width();
      const height = image.get_height();

      processingData = await new Promise((resolve, reject) => {
        image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (displayData) => {
          if (!displayData) return reject(new Error("Display mapping failed"));
          resolve(new ImageData(displayData.data, width, height));
        });
      });
    } catch (e) { throw e; }
  } else {
    processingData = file;
  }

  // Canvas描画・変換処理
  return new Promise((resolve, reject) => {
    const img = new Image();
    let url;

    if (processingData instanceof ImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = processingData.width;
      tempCanvas.height = processingData.height;
      tempCanvas.getContext('2d').putImageData(processingData, 0, 0);
      url = tempCanvas.toDataURL();
    } else {
      url = URL.createObjectURL(processingData);
    }

    img.onload = () => {
      // リサイズ計算: targetWidthがあれば計算、なければオリジナルサイズ
      let finalWidth, finalHeight;
      if (targetWidth) {
        const aspectRatio = img.naturalHeight / img.naturalWidth;
        finalWidth = targetWidth;
        finalHeight = targetWidth * aspectRatio;
      } else {
        finalWidth = img.naturalWidth;
        finalHeight = img.naturalHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // メタデータを削除しつつ描画
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

      canvas.toBlob((blob) => {
        if (!(processingData instanceof ImageData)) URL.revokeObjectURL(url);
        resolve(blob);
      }, format, quality);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}