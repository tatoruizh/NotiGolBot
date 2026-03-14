import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate, teams, teamsFile } from "../goalWatcher.js";

export default async function handler(req, res) {
  try {
    // ===== Leer body correctamente (Railway fix) =====
    let body = req.body;
    if (!body) {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      body = JSON.parse(raw);
    }

    if (!body?.message) return res.status(200).send("ok");

    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();
    if (!text) return res.status(200).send("ok");

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) return res.status(200).send("ok");

    // ===== Función enviar mensaje =====
    async function sendMessage(chatId, msg) {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg })
        });
      } catch (err) {
        console.log("Error enviando mensaje:", err);
      }
    }

    // ===== COMANDOS =====
    // LIST
    if (text === "/list") {
      const msg = "📋 Equipos vigilados:\n" + (teams.length ? teams.join("\n") : "No hay equipos aún");
      await sendMessage(chatId, msg);
    }
    // ADD
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
    // REMOVE
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      const index = teams.indexOf(teamToRemove);
      if (index > -1) teams.splice(index, 1);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);
    }
    // TODAY / TOMORROW
    else if (text === "/today" || text === "/tomorrow") {
      const date = new Date();
      if (text === "/tomorrow") date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().split("T")[0];

      const matches = await getMatchesByDate(dateStr);
      await sendMessage(chatId, `⚽ Partidos ${text === "/today" ? "de hoy" : "de mañana"}:\n\n` + matches.join("\n"));
    }

    return res.status(200).send("ok");

  } catch (err) {
    console.log("⚠️ Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
