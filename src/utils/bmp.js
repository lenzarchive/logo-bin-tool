function parseBmpHeader(buffer) {
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
    throw new Error("Invalid BMP magic bytes");
  }

  const view = new DataView(buffer.buffer ?? buffer);
  return {
    fileSize: view.getUint32(2, true),
    pixelOffset: view.getUint32(10, true),
    width: view.getInt32(18, true),
    height: Math.abs(view.getInt32(22, true)),
    bpp: view.getUint16(28, true),
  };
}

module.exports = { parseBmpHeader };
