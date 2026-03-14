import fs from "fs";
import fetch from "node-fetch";
import { getMatchesByDate } from "../goalWatcher.js";
import path from "path";

// Archivos JSON
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");

// Inicializar teams.json si no existe
if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));

export default async function handler(req, res) {
  try {
    // Validar body
    const body = req.body;
    if (!body || !body.message) return res.sendStatus(200);

    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();
    if (!text) return res.sendStatus(200);

    // Variables de entorno
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.log("⚠️ BOT_TOKEN o CHAT_ID no definidos");
      return res.sendStatus(500);
    }

    // Función para enviar mensaje
    async function sendMessage(chatId, msg) {
      try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg })
        });
      } catch (err) {
        console.log("⚠️ Error enviando mensaje:", err);
      }
    }

    // Leer teams.json
    let teams = [];
    try {
      teams = JSON.parse(fs.readFileSync(teamsFile));
    } catch (err) {
      console.log("⚠️ Error leyendo teams.json:", err);
      fs.writeFileSync(teamsFile, JSON.stringify([]));
      teams = [];
    }

    // ===== COMANDOS =====
    if (text === "/list") {
      await sendMessage(chatId, "📋 Equipos vigilados:\n" + (teams.length ? teams.join("\n") : "No hay equipos aún"));
    } 
    else if (text.startsWith("/add ")) {
      const teamToAdd = text.replace("/add ", "").trim();
      if (!teams.includes(teamToAdd)) {
        teams.push(teamToAdd);
        fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
        await sendMessage(chatId, `✅ ${teamToAdd} añadido a la lista`);
      } else {
        await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);
      }
    } 
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      teams = teams.filter(t => t !== teamToRemove);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado de la lista`);
    } 
    else if (text === "/today") {
      const today = new Date().toISOString().split("T")[0];
      let matches = [];
      try {
        matches = await getMatchesByDate(today);
      } catch (err) {
        matches = ["⚠️ Error al consultar SofaScore"];
      }
      await sendMessage(chatId, "⚽ Partidos de hoy:\n" + matches.join("\n"));
    } 
    else if (text === "/tomorrow") {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().split("T")[0];
      let matches = [];
      try {
        matches = await getMatchesByDate(tomorrow);
      } catch (err) {
        matches = ["⚠️ Error al consultar SofaScore"];
      }
      await sendMessage(chatId, "⚽ Partidos de mañana:\n" + matches.join("\n"));
    }

    // Responder 200 siempre
    res.sendStatus(200);
  } catch (err) {
    console.log("⚠️ Error en /api/command:", err);
    res.sendStatus(500);
  }
}
