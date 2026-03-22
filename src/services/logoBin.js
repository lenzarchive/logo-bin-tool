const zlib = require("zlib");
const { promisify } = require("util");
const { parseBmpHeader } = require("../utils/bmp");

const inflate = promisify(zlib.gunzip);
const deflate = promisify(zlib.gzip);

const MAGIC = Buffer.from([0x47, 0x5a]);
const SIZES_OFFSET = 24;
const SIZE_ENTRY = 4;

function computeHeaderSize(frameCount) {
  return SIZES_OFFSET + frameCount * SIZE_ENTRY;
}

function validateMagic(buffer) {
  return buffer[0] === MAGIC[0] && buffer[1] === MAGIC[1];
}

function readFrameSizes(buffer, count) {
  const sizes = [];
  for (let i = 0; i < count; i++) {
    sizes.push(buffer.readUInt32LE(SIZES_OFFSET + i * SIZE_ENTRY));
  }
  return sizes;
}

async function extractFrames(buffer) {
  if (!validateMagic(buffer)) {
    throw new Error("Invalid logo.bin: expected GZ magic bytes (0x47 0x5A)");
  }

  const frameCount = buffer.readUInt32LE(2);
  if (frameCount === 0 || frameCount > 64) {
    throw new Error(`Unexpected frame count: ${frameCount}. File may be corrupt or unsupported.`);
  }

  const HEADER_SIZE = computeHeaderSize(frameCount);
  if (buffer.length < HEADER_SIZE) {
    throw new Error("File too small to contain a valid header.");
  }

  const compressedSizes = readFrameSizes(buffer, frameCount);

  let offset = HEADER_SIZE;
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const chunk = buffer.slice(offset, offset + compressedSizes[i]);
    const decompressed = await inflate(chunk);
    const header = parseBmpHeader(decompressed);

    frames.push({
      index: i,
      compressedSize: compressedSizes[i],
      decompressedSize: decompressed.length,
      width: header.width,
      height: header.height,
      bpp: header.bpp,
      data: decompressed,
    });

    offset += compressedSizes[i];
  }

  return frames;
}

async function repackFrames(originalBuffer, frameIndex, newBmpBuffer) {
  if (!validateMagic(originalBuffer)) {
    throw new Error("Invalid logo.bin: expected GZ magic bytes (0x47 0x5A)");
  }

  const frameCount = originalBuffer.readUInt32LE(2);
  const HEADER_SIZE = computeHeaderSize(frameCount);
  const compressedSizes = readFrameSizes(originalBuffer, frameCount);

  let offset = HEADER_SIZE;
  const chunks = [];

  for (let i = 0; i < frameCount; i++) {
    chunks.push(originalBuffer.slice(offset, offset + compressedSizes[i]));
    offset += compressedSizes[i];
  }

  chunks[frameIndex] = await deflate(newBmpBuffer);

  const newSizes = chunks.map((c) => c.length);
  const totalPayload = newSizes.reduce((a, b) => a + b, 0);
  const output = Buffer.alloc(HEADER_SIZE + totalPayload);

  output[0] = MAGIC[0];
  output[1] = MAGIC[1];
  output.writeUInt32LE(frameCount, 2);

  for (let i = 0; i < frameCount; i++) {
    output.writeUInt32LE(newSizes[i], SIZES_OFFSET + i * SIZE_ENTRY);
  }

  let writeOffset = HEADER_SIZE;
  for (const chunk of chunks) {
    chunk.copy(output, writeOffset);
    writeOffset += chunk.length;
  }

  return output;
}

module.exports = { extractFrames, repackFrames };
