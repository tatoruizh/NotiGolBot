import "./goalWatcher.js";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.BOT_TOKEN;

// Registrar comandos en Telegram
async function setCommands() {
  const commands = [
    { command: "list", description: "Lista los equipos vigilados" },
    { command: "add", description: "Añadir un equipo a la lista" },
    { command: "remove", description: "Eliminar un equipo de la lista" },
    { command: "today", description: "Mostrar partidos de hoy" },
    { command: "tomorrow", description: "Mostrar partidos de mañana" }
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands })
    });

    const data = await res.json();
    if (data.ok) {
      console.log("Comandos registrados ✅");
    } else {
      console.log("Error registrando comandos:", data);
    }
  } catch (err) {
    console.log("Error al registrar comandos:", err);
  }
}

// Ejecutar al iniciar
setCommands();

console.log("Bot iniciado y goalWatcher activo ✅");
