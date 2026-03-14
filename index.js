import express from "express";
import commandHandler from "./api/command.js";
import "./goalWatcher.js"; // activa el watcher automático de goles

const app = express();
app.use(express.json());

// Endpoint para comandos de Telegram
app.post("/api/command", commandHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port", PORT);
});
