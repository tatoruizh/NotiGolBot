import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

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

    // ===== Leer teams.json =====
    let teams = [];
    try {
      if (fs.existsSync(teamsFile)) teams = JSON.parse(fs.readFileSync(teamsFile));
      else fs.writeFileSync(teamsFile, JSON.stringify([]));
    } catch {
      fs.writeFileSync(teamsFile, JSON.stringify([]));
      teams = [];
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
      } else await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);
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

      const matches = await getMatchesByDate(dateStr);
      await sendMessage(chatId, `⚽ Partidos ${text === "/today" ? "de hoy" : "de mañana"}:\n\n` + matches.join("\n"));
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.log("⚠️ Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
