// index.js
import http from "http";
import handler from "./api/command.js";
import { checkMatches } from "./goalWatcher.js";

const PORT = process.env.PORT || 3000;

// 🔹 Ejecutar revisión de partidos al iniciar
checkMatches(); // primera ejecución inmediata

// 🔹 Servidor HTTP para recibir webhooks de Telegram
const server = http.createServer(async (req, res) => {
  try {
    // Solo POST a /api/command
    if (req.method === "POST" && req.url.startsWith("/api/command")) {
      await handler(req, res);
      return;
    }

    // Respuesta por defecto para otras rutas
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot activo ✅");
  } catch (err) {
    console.error("Error en server:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error interno del servidor");
  }
});

// 🔹 Iniciar servidor
server.listen(PORT, () => {
  console.log(`Bot iniciado ✅ - escuchando en puerto ${PORT}`);
});
