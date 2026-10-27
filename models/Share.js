const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ["text", "file"], required: true },
  text: { type: String, default: "" },
  originalName: { type: String, default: "" },
  storedName: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true }
});

module.exports = mongoose.model("Share", shareSchema);
