let frames = [];
let currentReplaceIndex = -1;

const canvas = document.getElementById("offscreenCanvas");

function init() {
  lucide.createIcons();

  const zone = document.getElementById("uploadZone");
  const binInput = document.getElementById("binInput");
  const imageInput = document.getElementById("imageInput");

  zone.addEventListener("click", () => binInput.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleBinFile(file);
  });

  binInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleBinFile(e.target.files[0]);
  });

  imageInput.addEventListener("change", (e) => {
    if (e.target.files[0] && currentReplaceIndex >= 0) {
      handleReplaceImage(currentReplaceIndex, e.target.files[0]);
    }
  });
}

async function handleBinFile(file) {
  log(`Loading ${file.name} (${formatBytes(file.size)})`, "info");
  setProgress(true, 10);

  try {
    const buffer = await file.arrayBuffer();
    frames = await parseLogoBin(buffer);

    const first = frames[0];
    setInfoBar({
      fileSize: file.size,
      frameCount: frames.length,
      width: first.width,
      height: first.height,
    });

    log(`Parsed ${frames.length} frames — ${first.width}×${first.height} @ 24bpp`, "ok");
    setProgress(true, 100);
    setTimeout(() => setProgress(false), 500);

    renderFrames();

    document.getElementById("framesSection").classList.remove("hidden");
    document.getElementById("downloadBtn").disabled = true;
  } catch (err) {
    log(err.message, "err");
    setProgress(false);
  }
}

function renderFrames() {
  const grid = document.getElementById("framesGrid");
  grid.innerHTML = "";

  for (const frame of frames) {
    const card = document.createElement("div");
    card.className = "frame-card" + (frame.modified ? " modified" : "");
    card.dataset.index = frame.index;

    card.innerHTML = `
      ${frame.modified ? `
        <div class="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 bg-green text-bg text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
          <i data-lucide="check" class="w-2.5 h-2.5"></i>
          Modified
        </div>` : ""}
      <img class="w-full object-cover block bg-black" style="aspect-ratio:9/20" src="${frame.url}" loading="lazy">
      <div class="px-3 py-2 bg-bg-3 border-t border-border">
        <div class="text-[11px] font-bold text-ink-2 uppercase tracking-wide mb-0.5">Frame ${frame.index}</div>
        <div class="text-[10px] text-ink-3">${formatBytes(frame.compressedSize)}</div>
      </div>
      <div class="frame-hover-overlay flex-col gap-2">
        <button class="frame-replace-btn flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-4 py-2 bg-accent text-bg rounded">
          <i data-lucide="image-plus" class="w-3.5 h-3.5"></i>
          Replace
        </button>
        <button class="frame-download-btn flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-4 py-2 bg-transparent text-ink border border-border-2 rounded hover:border-ink-3 transition-colors duration-150">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
          Download
        </button>
      </div>
    `;

    card.querySelector(".frame-replace-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerReplace(frame.index);
    });

    card.querySelector(".frame-download-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadFrame(frame.index);
    });

    grid.appendChild(card);
    lucide.createIcons({ nodes: [card] });
  }

  const modCount = frames.filter((f) => f.modified).length;
  updateModifiedCount(modCount);
  document.getElementById("downloadBtn").disabled = modCount === 0;
}

function triggerReplace(index) {
  currentReplaceIndex = index;
  const input = document.getElementById("imageInput");
  input.value = "";
  input.click();
}

async function handleReplaceImage(index, file) {
  log(`Replacing frame ${index} with ${file.name}...`, "info");
  setProgress(true, 30);

  try {
    frames = await replaceFrame(frames, index, file, canvas);
    setProgress(true, 90);
    renderFrames();
    setProgress(true, 100);
    setTimeout(() => setProgress(false), 500);
    log(`Frame ${index} replaced successfully`, "ok");
  } catch (err) {
    log(err.message, "err");
    setProgress(false);
  }
}

async function handleDownload() {
  log("Building logo_new.bin...", "info");
  setProgress(true, 40);

  try {
    const result = await buildLogoBin(frames);
    const blob = new Blob([result], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logo_new.bin";
    a.click();
    URL.revokeObjectURL(a.href);
    setProgress(true, 100);
    setTimeout(() => setProgress(false), 500);
    log(`logo_new.bin downloaded (${formatBytes(result.length)})`, "ok");
  } catch (err) {
    log(err.message, "err");
    setProgress(false);
  }
}

async function downloadFrame(index) {
  const frame = frames[index];
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");

  const img = await new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = frame.url;
  });

  ctx.drawImage(img, 0, 0);

  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `frame_${index}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    log(`Downloaded frame_${index}.png`, "ok");
  }, "image/png");
}

async function handleExtractAll() {
  log("Extracting all frames as PNG...", "info");

  for (const frame of frames) {
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");

    const img = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.src = frame.url;
    });

    ctx.drawImage(img, 0, 0);

    await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `frame_${frame.index}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        log(`Extracted frame_${frame.index}.png`, "ok");
        resolve();
      }, "image/png");
    });

    await new Promise((r) => setTimeout(r, 250));
  }
}

function handleReset() {
  frames.forEach((f) => URL.revokeObjectURL(f.url));
  frames = [];
  currentReplaceIndex = -1;

  document.getElementById("framesGrid").innerHTML = "";
  document.getElementById("infoBar").classList.add("hidden");
  document.getElementById("framesSection").classList.add("hidden");
  document.getElementById("logBody").innerHTML = "";
  document.getElementById("logPanel").classList.add("hidden");
  document.getElementById("binInput").value = "";
  setProgress(false);
}

document.addEventListener("DOMContentLoaded", init);
