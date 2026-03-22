const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { extractFrames, repackFrames } = require("../services/logoBin");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((RATE_WINDOW - (now - entry.windowStart)) / 1000);
    res.set("Retry-After", retryAfter);
    return res.status(429).json({
      error: `Too many requests. Try again in ${retryAfter}s.`,
    });
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_WINDOW) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW);

router.post("/extract", rateLimit, upload.single("bin"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const frames = await extractFrames(req.file.buffer);
    const meta = frames.map((f) => ({
      index: f.index,
      width: f.width,
      height: f.height,
      bpp: f.bpp,
      compressedSize: f.compressedSize,
      decompressedSize: f.decompressedSize,
    }));

    res.json({ success: true, frameCount: frames.length, frames: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/frame/:index", rateLimit, upload.single("bin"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const index = parseInt(req.params.index, 10);
    const frames = await extractFrames(req.file.buffer);

    if (index < 0 || index >= frames.length) {
      return res.status(404).json({ error: "Frame index out of range" });
    }

    res.set("Content-Type", "image/bmp");
    res.set("Content-Disposition", `attachment; filename="frame_${index}.bmp"`);
    res.send(frames[index].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/replace",
  rateLimit,
  upload.fields([{ name: "bin" }, { name: "image" }]),
  async (req, res) => {
    try {
      const binFile = req.files?.["bin"]?.[0];
      const imageFile = req.files?.["image"]?.[0];

      if (!binFile || !imageFile) {
        return res.status(400).json({ error: "Both bin and image files are required" });
      }

      const frameIndex = parseInt(req.body.frameIndex, 10);
      const frames = await extractFrames(binFile.buffer);

      if (isNaN(frameIndex) || frameIndex < 0 || frameIndex >= frames.length) {
        return res.status(400).json({ error: "Invalid frameIndex" });
      }

      const { width, height, decompressedSize } = frames[frameIndex];

      const rawPixels = await sharp(imageFile.buffer)
        .resize(width, height, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer();

      const rowSize = Math.ceil((width * 3) / 4) * 4;
      const pixelDataSize = rowSize * height;
      const minSize = 54 + pixelDataSize;

      if (decompressedSize < minSize) {
        return res.status(400).json({
          error: `Frame ${frameIndex} decompressedSize (${decompressedSize}) is smaller than ` +
                 `minimum BMP size (${minSize}) for ${width}×${height}. File may be corrupt.`,
        });
      }

      const bmpBuffer = Buffer.alloc(decompressedSize);

      bmpBuffer[0] = 0x42;
      bmpBuffer[1] = 0x4d;
      bmpBuffer.writeUInt32LE(decompressedSize, 2);
      bmpBuffer.writeUInt32LE(0, 6);
      bmpBuffer.writeUInt32LE(54, 10);
      bmpBuffer.writeUInt32LE(40, 14);
      bmpBuffer.writeInt32LE(width, 18);
      bmpBuffer.writeInt32LE(height, 22);
      bmpBuffer.writeUInt16LE(1, 26);
      bmpBuffer.writeUInt16LE(24, 28);
      bmpBuffer.writeUInt32LE(0, 30);
      bmpBuffer.writeUInt32LE(pixelDataSize, 34);
      bmpBuffer.writeInt32LE(2835, 38);
      bmpBuffer.writeInt32LE(2835, 42);
      bmpBuffer.writeUInt32LE(0, 46);
      bmpBuffer.writeUInt32LE(0, 50);

      for (let y = 0; y < height; y++) {
        const srcRow = (height - 1 - y) * width;
        const dstRow = 54 + y * rowSize;
        for (let x = 0; x < width; x++) {
          const si = (srcRow + x) * 3;
          const di = dstRow + x * 3;
          bmpBuffer[di + 0] = rawPixels[si + 2];
          bmpBuffer[di + 1] = rawPixels[si + 1];
          bmpBuffer[di + 2] = rawPixels[si + 0];
        }
      }

      const result = await repackFrames(binFile.buffer, frameIndex, bmpBuffer);

      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", 'attachment; filename="logo_new.bin"');
      res.send(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
