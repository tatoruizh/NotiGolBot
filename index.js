// index.js
import express from "express";
import fs from "fs";
import path from "path";
import commandHandler from "./api/command.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Ruta de webhook de Telegram
app.post("/api/command", async (req, res) => {
  try {
    await commandHandler(req, res);
  } catch (err) {
    console.error("Error en commandHandler:", err);
    res.sendStatus(500);
  }
});

// Función opcional para alertas de inicio/final de partido
// Podrías integrarla con SofaScore u otra API
async function startGoalPolling() {
  // aquí iría la lógica para comprobar partidos activos
  // y enviar alertas de goles, inicio y final
  // ejemplo:
  // if (golNuevo) enviarMensaje(chatId, "⚽ GOL: Real Madrid 1-0 Barcelona");
}

// Inicia la “polling loop” si quieres
startGoalPolling();

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Bot corriendo en puerto ${PORT}`);
});
