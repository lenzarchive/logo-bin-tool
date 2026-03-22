# logo-bin-tool

A web-based tool for extracting, replacing, and repacking Unisoc / Spreadtrum `logo.bin` firmware images. All frame processing runs locally in the browser — no file uploads to any server.

## Features

- Load `logo.bin` via drag-and-drop or file picker
- Preview all embedded frames in a responsive grid
- Replace any frame with a custom image (auto-resized to original resolution)
- Download the patched `logo.bin` ready to flash
- Extract all frames as individual PNG files

## Supported Format

| Property | Value |
|---|---|
| Container | GZ-compressed multi-frame BMP |
| Color depth | 24bpp (BGR) |
| Row order | Bottom-up |
| Tested device | Unisoc SC9863A / SC7731E series |

## Binary Format

### File Header

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0x00 | 2B | `u8[2]` | Magic bytes `47 5A` ("GZ") |
| 0x02 | 4B | `uint32 LE` | Frame count (typically 2–15) |
| 0x06 | 18B | — | Reserved, all zeros |
| 0x18 | 4B × N | `uint32 LE` | Compressed byte size for each frame |
| 0x18 + (N × 4) | variable | — | Concatenated gzip-compressed BMP payloads |

### Frame Payload

Each frame is a standard gzip stream containing a raw 24bpp bottom-up BMP. The gzip header includes an embedded filename (`1.bmp`, `2.bmp`, …) set by the firmware packer. The decompressed BMP uses the standard 54-byte header followed by unpadded BGR pixel rows aligned to a 4-byte boundary.

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## Installation

```bash
git clone https://github.com/lenzarchive/logo-bin-tool
cd logo-bin-tool
npm install
```

## Build

Before starting the server, compile the CSS and copy the icon bundle:

```bash
npm run build
```

This runs two steps:

1. `build:css` — compiles `src/css/input.css` through Tailwind CSS into `public/css/style.css`
2. `build:icons` — copies the Lucide UMD bundle from `node_modules` into `public/js/vendor/lucide.js`

## Usage

### Development

Watches for CSS changes and restarts the server on file changes:

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

The server listens on `http://localhost:3000` by default. Set the `PORT` environment variable to change it.

## Project Structure

```
logo-bin-tool/
├── server.js                   # Express entry point
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── README.md
├── scripts/
│   └── copyIcons.js            # Copies Lucide bundle to public
├── src/
│   ├── css/
│   │   └── input.css           # Tailwind directives + component styles
│   ├── routes/
│   │   └── api.js              # REST API endpoints (server-side processing)
│   ├── services/
│   │   └── logoBin.js          # Core parse and repack logic
│   └── utils/
│       └── bmp.js              # BMP header utilities
└── public/
    ├── index.html
    ├── css/
    │   └── style.css           # Compiled Tailwind output (generated)
    └── js/
        ├── vendor/
        │   └── lucide.js       # Lucide UMD bundle (generated)
        ├── app.js              # Application controller
        ├── parser.js           # logo.bin parser (browser, uses pako)
        ├── bmp.js              # BMP writer (browser)
        └── ui.js               # UI helpers and logging
```

## API Endpoints

All endpoints accept `multipart/form-data`.

### `POST /api/extract`

Parses a `logo.bin` and returns frame metadata.

**Body:** `bin` (file)

**Response:**
```json
{
  "success": true,
  "frameCount": 5,
  "frames": [
    { "index": 0, "width": 720, "height": 1612, "bpp": 24, "compressedSize": 17997, "decompressedSize": 3481976 }
  ]
}
```

### `POST /api/frame/:index`

Returns the raw BMP data for a single frame.

**Body:** `bin` (file)

**Response:** `image/bmp` binary

### `POST /api/replace`

Replaces a frame and returns the patched `logo.bin`.

**Body:** `bin` (file), `image` (file), `frameIndex` (integer)

**Response:** `application/octet-stream` — `logo_new.bin`

## Notes

- File size of the repacked `logo.bin` may differ from the original due to gzip compression variance. Verify your device's logo partition is large enough before flashing.
- Always keep a backup of the original `logo.bin` before flashing.
- Tested against Android 11 Unisoc firmware. Behavior on other versions may vary.

## Flowchart

[click me!](https://github.com/lenzarchive/logo-bin-tool/blob/main/FLOWCHART.md)

## License

MIT — AlwizBA
