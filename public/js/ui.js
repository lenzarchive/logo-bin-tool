function log(message, type = "info") {
  const panel = document.getElementById("logPanel");
  const body = document.getElementById("logBody");

  panel.classList.remove("hidden");

  const icons = { ok: "check", info: "chevron-right", warn: "alert-triangle", err: "x-circle" };
  const colors = { ok: "text-green", info: "text-blue", warn: "text-accent", err: "text-red" };
  const time = new Date().toLocaleTimeString("id-ID", { hour12: false });

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `
    <span class="text-ink-3">${time}</span>
    <i data-lucide="${icons[type] ?? "chevron-right"}" class="w-3 h-3 mt-0.5 flex-shrink-0 ${colors[type] ?? "text-blue"}"></i>
    <span>${message}</span>
  `;

  body.appendChild(entry);
  lucide.createIcons({ nodes: [entry] });
  body.scrollTop = body.scrollHeight;
}

function setProgress(visible, percent = 0) {
  const track = document.getElementById("progressTrack");
  const fill = document.getElementById("progressFill");

  if (visible) {
    track.classList.remove("hidden");
    fill.style.width = `${percent}%`;
  } else {
    track.classList.add("hidden");
    fill.style.width = "0%";
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function setInfoBar(data) {
  document.getElementById("infoBar").classList.remove("hidden");
  document.getElementById("infoSize").textContent = formatBytes(data.fileSize);
  document.getElementById("infoFrames").textContent = data.frameCount;
  document.getElementById("infoRes").textContent = `${data.width} × ${data.height}`;
  document.getElementById("infoFormat").textContent = "GZ / BMP 24bpp";
}

function updateModifiedCount(count) {
  document.getElementById("infoModified").textContent = `${count} frame${count !== 1 ? "s" : ""}`;
}
