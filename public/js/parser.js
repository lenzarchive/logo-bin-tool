const GZ_MAGIC = [0x47, 0x5a];
const SIZES_OFFSET = 24;
const SIZE_ENTRY = 4;

function computeHeaderSize(frameCount) {
  return SIZES_OFFSET + frameCount * SIZE_ENTRY;
}

function validateMagic(bytes) {
  return bytes[0] === GZ_MAGIC[0] && bytes[1] === GZ_MAGIC[1];
}

function readSizes(view, count) {
  const sizes = [];
  for (let i = 0; i < count; i++) {
    sizes.push(view.getUint32(SIZES_OFFSET + i * SIZE_ENTRY, true));
  }
  return sizes;
}

async function parseLogoBin(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  if (!validateMagic(bytes)) throw new Error("Invalid file: expected GZ magic bytes (0x47 0x5A)");

  const frameCount = view.getUint32(2, true);
  if (frameCount === 0 || frameCount > 64) {
    throw new Error(`Unexpected frame count: ${frameCount}. File may be corrupt or unsupported.`);
  }

  const HEADER_SIZE = computeHeaderSize(frameCount);
  if (arrayBuffer.byteLength < HEADER_SIZE) {
    throw new Error("File too small to contain a valid header.");
  }

  const sizes = readSizes(view, frameCount);

  let offset = HEADER_SIZE;
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const chunk = bytes.slice(offset, offset + sizes[i]);
    const decompressed = pako.inflate(chunk);
    const meta = parseBmpMeta(decompressed);

    const blob = new Blob([decompressed], { type: "image/bmp" });
    const url = URL.createObjectURL(blob);

    frames.push({
      index: i,
      chunk,
      decompressed,
      url,
      width: meta.width,
      height: meta.height,
      bmpFileSize: meta.fileSize,
      compressedSize: sizes[i],
      modified: false,
    });

    offset += sizes[i];
  }

  return frames;
}

async function buildLogoBin(frames) {
  const recompressed = frames.map((f) => pako.gzip(f.decompressed, { level: 9 }));

  const sizes = recompressed.map((c) => c.length);
  const totalPayload = sizes.reduce((a, b) => a + b, 0);
  const HEADER_SIZE = computeHeaderSize(frames.length);
  const output = new Uint8Array(HEADER_SIZE + totalPayload);
  const outView = new DataView(output.buffer);

  output[0] = GZ_MAGIC[0];
  output[1] = GZ_MAGIC[1];
  outView.setUint32(2, frames.length, true);

  for (let i = 0; i < frames.length; i++) {
    outView.setUint32(SIZES_OFFSET + i * SIZE_ENTRY, sizes[i], true);
  }

  let writeOffset = HEADER_SIZE;
  for (const chunk of recompressed) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return output;
}

async function replaceFrame(frames, index, imageFile, canvas) {
  const frame = frames[index];
  const { width, height, bmpFileSize } = frame;

  const img = await loadImage(imageFile);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const newBmp = imageToBmp(imageData, width, height, bmpFileSize);

  URL.revokeObjectURL(frame.url);
  const newBlob = new Blob([newBmp], { type: "image/bmp" });

  frames[index] = {
    ...frame,
    decompressed: newBmp,
    url: URL.createObjectURL(newBlob),
    modified: true,
  };

  return frames;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}
