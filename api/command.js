// api/command.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

// Asegurar que teams.json existe
if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));

export default async function handler(req, res) {
  try {
    // ===== Leer body del webhook de Telegram =====
    let body;
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      body = JSON.parse(raw);
    } catch (err) {
      console.log("⚠️ Error parseando body:", err);
      body = {};
    }

    // Si no es un mensaje válido, devolver 200 OK
    if (!body?.message) return res.status(200).send("ok");

    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();
    if (!text) return res.status(200).send("ok");

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.log("❌ BOT_TOKEN no definido");
      return res.status(200).send("ok");
    }

    // ===== Función para enviar mensaje a Telegram =====
    async function sendMessage(chatId, msg) {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg })
        });
      } catch (err) {
        console.log("⚠️ Error enviando mensaje:", err);
      }
    }

    // ===== Leer teams.json =====
    let teams = [];
    try {
      teams = JSON.parse(fs.readFileSync(teamsFile));
    } catch {
      teams = [];
      fs.writeFileSync(teamsFile, JSON.stringify([]));
    }

    // ===== COMANDOS =====

    if (text === "/list") {
      const msg = "📋 Equipos vigilados:\n" + (teams.length ? teams.join("\n") : "No hay equipos aún");
      await sendMessage(chatId, msg);
    } 
    else if (text.startsWith("/add ")) {
      const teamToAdd = text.replace("/add ", "").trim();
      if (!teams.includes(teamToAdd)) {
        teams.push(teamToAdd);
        fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
        await sendMessage(chatId, `✅ ${teamToAdd} añadido`);
      } else {
        await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);
      }
    } 
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      teams = teams.filter(t => t !== teamToRemove);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);
    } 
    else if (text === "/today" || text === "/tomorrow") {
      const date = new Date();
      if (text === "/tomorrow") date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().split("T")[0];

      // ⚽ Obtener partidos desde TheSportsDB
      let matches = [];
      try {
        matches = await getMatchesByDate(dateStr);
      } catch (err) {
        console.log("⚠️ Error getMatchesByDate:", err);
        matches = ["Error al consultar los partidos"];
      }

      await sendMessage(chatId, `⚽ Partidos ${text === "/today" ? "de hoy" : "de mañana"}:\n\n` + matches.join("\n"));
    }

    // Siempre responder 200 OK a Telegram
    return res.status(200).send("ok");

  } catch (err) {
    console.log("⚠️ Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
