const zlib = require("zlib");
const { promisify } = require("util");
const { parseBmpHeader } = require("../utils/bmp");

const inflate = promisify(zlib.gunzip);
const deflate = promisify(zlib.gzip);

const HEADER_SIZE = 44;
const MAGIC = Buffer.from([0x47, 0x5a]);

function validateMagic(buffer) {
  return buffer[0] === MAGIC[0] && buffer[1] === MAGIC[1];
}

function readFrameSizes(buffer, count) {
  const sizes = [];
  for (let i = 0; i < count; i++) {
    sizes.push(buffer.readUInt32LE(24 + i * 4));
  }
  return sizes;
}

async function extractFrames(buffer) {
  if (!validateMagic(buffer)) {
    throw new Error("Invalid logo.bin: expected GZ magic");
  }

  const frameCount = buffer.readUInt32LE(2);
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
    throw new Error("Invalid logo.bin: expected GZ magic");
  }

  const frameCount = originalBuffer.readUInt32LE(2);
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
    output.writeUInt32LE(newSizes[i], 24 + i * 4);
  }

  let writeOffset = HEADER_SIZE;
  for (const chunk of chunks) {
    chunk.copy(output, writeOffset);
    writeOffset += chunk.length;
  }

  return output;
}

module.exports = { extractFrames, repackFrames };
