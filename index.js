import http from "http";
import handler from "./api/command.js";

const server = http.createServer(async (req, res) => {

  if (req.method === "POST" && req.url === "/api/command") {

    await handler(req, res);
    return;

  }

  res.writeHead(200);
  res.end("Bot activo");

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Bot iniciado ✅ - escuchando en puerto", PORT);
});
