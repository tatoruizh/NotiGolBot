import http from "http";
import handler from "./api/command.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  try {
    // 🔹 Solo procesar POST a /api/command
    if (req.method === "POST" && req.url.startsWith("/api/command")) {
      await handler(req, res);
      return;
    }

    // 🔹 Ruta raíz responde que el bot está activo
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot activo ✅");
  } catch (err) {
    console.error("Error en server:", err);

    // 🔹 Responder 200 siempre para Telegram (no rompe webhook)
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Error interno del servidor");
  }
});

// 🔹 Iniciar servidor
server.listen(PORT, () => {
  console.log(`Bot iniciado ✅ - escuchando en puerto ${PORT}`);
});
