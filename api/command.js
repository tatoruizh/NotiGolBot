import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate, teams as globalTeams } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

export default async function handler(req, res) {
  try {
    const body = req.body || (await req.json());
    console.log("⚡ Update recibido:", body);

    if (!body || !body.message) return res.sendStatus(200);

    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();
    if (!text) return res.sendStatus(200);

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) return res.sendStatus(500);

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

    let teams = [];
    try {
      teams = JSON.parse(fs.readFileSync(teamsFile));
    } catch {
      fs.writeFileSync(teamsFile, JSON.stringify([]));
      teams = [];
    }

    // COMANDOS
    if (text === "/list") {
      await sendMessage(chatId, "📋 Equipos vigilados:\n" + (teams.length ? teams.join("\n") : "No hay equipos aún"));
    } 
    else if (text.startsWith("/add ")) {
      const teamToAdd = text.replace("/add ", "").trim();
      if (!teams.includes(teamToAdd)) {
        teams.push(teamToAdd);
        fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
        await sendMessage(chatId, `✅ ${teamToAdd} añadido`);
      } else {
        await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba`);
      }
    } 
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      teams = teams.filter(t => t !== teamToRemove);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);
    } 
    else if (text === "/today") {
      const today = new Date().toISOString().split("T")[0];
      const matches = await getMatchesByDate(today);
      await sendMessage(chatId, "⚽ Partidos de hoy:\n" + matches.join("\n"));
    } 
    else if (text === "/tomorrow") {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().split("T")[0];
      const matches = await getMatchesByDate(tomorrow);
      await sendMessage(chatId, "⚽ Partidos de mañana:\n" + matches.join("\n"));
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("⚠️ Error en handler:", err);
    res.sendStatus(500);
  }
}
