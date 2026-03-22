function imageToBmp(imageData, width, height, targetFileSize) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const minFileSize = 54 + pixelDataSize;

  if (targetFileSize && targetFileSize < minFileSize) {
    throw new Error(
      `targetFileSize (${targetFileSize}) is smaller than the minimum required ` +
      `BMP size (${minFileSize}) for a ${width}×${height} 24bpp image. ` +
      `The original logo.bin may be corrupt or from an unsupported variant.`
    );
  }

  const fileSize = targetFileSize || minFileSize;
  const buffer = new ArrayBuffer(fileSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  const src = imageData.data;

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width;
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const si = (srcRow + x) * 4;
      const di = dstRow + x * 3;
      bytes[di + 0] = src[si + 2];
      bytes[di + 1] = src[si + 1];
      bytes[di + 2] = src[si + 0];
    }
  }

  return new Uint8Array(buffer);
}

function parseBmpMeta(bytes) {
  const view = new DataView(bytes.buffer ?? bytes);
  return {
    fileSize: view.getUint32(2, true),
    width: view.getInt32(18, true),
    height: Math.abs(view.getInt32(22, true)),
  };
}
