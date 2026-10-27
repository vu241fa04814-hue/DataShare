require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Share = require("./models/Share");

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

function createCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = createCode();
    if (!(await Share.exists({ code }))) return code;
  }
  throw new Error("Could not generate a unique code. Please try again.");
}
function getExpiry(hours) {
  const validHours = Math.min(168, Math.max(1, Number(hours) || 24));
  return new Date(Date.now() + validHours * 60 * 60 * 1000);
}
async function removeExpiredFiles() {
  try {
    const expired = await Share.find({ expiresAt: { $lte: new Date() }, type: "file" }).lean();
    for (const item of expired) {
      if (item.storedName) {
        const filePath = path.join(UPLOAD_DIR, item.storedName);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (error) { console.error("File cleanup:", error.message); }
        }
      }
    }
    await Share.deleteMany({ expiresAt: { $lte: new Date() } });
  } catch (error) {
    console.error("Expired-share cleanup failed:", error.message);
  }
}
setInterval(removeExpiredFiles, 60 * 1000);

app.post("/api/share/text", async (req, res) => {
  try {
    const { text, expiryHours } = req.body || {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Please enter some text before generating a code." });
    }
    const code = await uniqueCode();
    const share = await Share.create({
      code, type: "text", text,
      expiresAt: getExpiry(expiryHours)
    });
    res.status(201).json({ code: share.code, expiresAt: share.expiresAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save text. Check that MongoDB is running." });
  }
});

app.post("/api/share/file", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please choose a file to upload." });
  try {
    const code = await uniqueCode();
    const share = await Share.create({
      code, type: "file",
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      expiresAt: getExpiry(req.body.expiryHours)
    });
    res.status(201).json({ code: share.code, expiresAt: share.expiresAt });
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    console.error(error);
    res.status(500).json({ error: "Could not save file details. Check that MongoDB is running." });
  }
});

app.get("/api/share/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "");
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter a valid 6-digit code." });
    const share = await Share.findOne({ code, expiresAt: { $gt: new Date() } }).lean();
    if (!share) return res.status(404).json({ error: "No content found. The code may be incorrect or expired." });
    if (share.type === "text") {
      return res.json({ type: "text", text: share.text, expiresAt: share.expiresAt });
    }
    return res.json({
      type: "file", fileName: share.originalName, size: share.size,
      expiresAt: share.expiresAt, downloadUrl: `/api/share/${code}/download`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not retrieve content." });
  }
});

app.get("/api/share/:code/download", async (req, res) => {
  try {
    const share = await Share.findOne({
      code: String(req.params.code || ""),
      type: "file",
      expiresAt: { $gt: new Date() }
    }).lean();
    if (!share) return res.status(404).send("File not found or the share code has expired.");
    const filePath = path.join(UPLOAD_DIR, share.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).send("The uploaded file is missing from the server.");
    return res.download(filePath, share.originalName);
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not download the file.");
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "The maximum file size is 100 MB." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

async function start() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/datashare";
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully.");
    app.listen(PORT, () => console.log(`DataShare is running at http://localhost:${PORT}`));
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error("Start local MongoDB or add your MongoDB Atlas connection string to .env.");
    process.exit(1);
  }
}
start();
