import http from "http";
import handler from "./api/command.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  try {

    if (req.method === "POST" && req.url.startsWith("/api/command")) {
      await handler(req, res);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot activo ✅");

  } catch (err) {
    console.error("Error en servidor:", err);
    res.writeHead(200);
    res.end("ok");
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Bot iniciado en puerto ${PORT}`);
});
