const express = require("express");
const path = require("path");
const apiRouter = require("./src/routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", apiRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`logo-bin-tool running at http://localhost:${PORT}`);
});
