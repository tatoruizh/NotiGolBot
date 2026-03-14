import { checkMatches } from "./goalWatcher.js";
import fetch from "node-fetch";

// Variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("⚠️ BOT_TOKEN o CHAT_ID no definidos. El bot no podrá enviar mensajes ni registrar comandos.");
} else {
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
        console.log("✅ Comandos registrados en Telegram");
      } else {
        console.log("⚠️ Error registrando comandos:", data);
      }
    } catch (err) {
      console.log("⚠️ Error al registrar comandos:", err);
    }
  }

  // Ejecutar registro de comandos
  setCommands();

  // Iniciar goalWatcher
  try {
    checkMatches();
    console.log("✅ goalWatcher iniciado y bot activo");
  } catch (err) {
    console.log("⚠️ Error iniciando goalWatcher:", err);
  }
}
