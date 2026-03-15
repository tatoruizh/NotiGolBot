// index.js
import http from "http";
import fetch from "node-fetch";
import handler from "./api/command.js";
import { checkMatchesAndNotify, saveState } from "./goalWatcher.js";

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendToConfiguredChat(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
  } catch (err) {
    console.log("sendToConfiguredChat error:", err);
  }
}

// Lanzar watcher cada 60s (funciona en Railway free mientras el proceso esté activo)
setInterval(() => {
  // no await directo en setInterval - envolver en IIFE
  (async () => {
    try {
      await checkMatchesAndNotify(sendToConfiguredChat);
    } catch (e) {
      console.log("Watcher interval error:", e);
    }
  })();
}, 60 * 1000);

// HTTP server para webhook
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url.startsWith("/api/command")) {
      await handler(req, res); // handler responde OK
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot activo ✅");
  } catch (err) {
    console.log("Server error:", err);
    try { res.writeHead(200); res.end("ok"); } catch {}
  }
});

process.on("exit", saveState);
process.on("SIGINT", () => { saveState(); process.exit(); });
process.on("SIGTERM", () => { saveState(); process.exit(); });

server.listen(PORT, () => console.log(`Bot iniciado en puerto ${PORT}`));
