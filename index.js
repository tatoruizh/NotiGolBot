// index.js
import express from "express";
import commandHandler from "./api/command.js";

const app = express();

// Para leer JSON de Telegram
app.use(express.json());

// Endpoint que Telegram llamará
app.post("/api/command", commandHandler);

// Railway asigna un puerto automáticamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot corriendo en puerto ${PORT}`);
});
