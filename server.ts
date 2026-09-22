import "dotenv/config";
import http from "http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { processChatMessage, formatGeminiError } from "./server/chat-handler.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: "15mb" }));

// API route
app.post("/api/chat", async (req, res) => {
  try {
    const { message, audioBase64, audioMimeType, history, memory, isVoiceMode } = req.body;
    if (!message && !audioBase64) {
      return res.status(400).json({ error: "Either a message string or audioBase64 is required" });
    }
    const result = await processChatMessage({ message, audioBase64, audioMimeType, history, memory, isVoiceMode });
    res.json(result);
  } catch (err: unknown) {
    console.error("Chat error in server.ts:", err);
    const errorMessage = formatGeminiError(err);
    res.status(500).json({ error: errorMessage });
  }
});

// Serve frontend assets in production
const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});

const server = http.createServer(app);
server.listen(port, "0.0.0.0", () => {
  console.log(`YahiaGPT server listening on http://0.0.0.0:${port}`);
});
