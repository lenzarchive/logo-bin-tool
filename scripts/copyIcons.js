const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../node_modules/lucide/dist/umd/lucide.js");
const dest = path.join(__dirname, "../public/js/vendor/lucide.js");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);

console.log("Lucide icons copied to public/js/vendor/lucide.js");
