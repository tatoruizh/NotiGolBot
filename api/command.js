import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getLiveMatches, teams } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

export default async function handler(req, res) {
  try {
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

    let localTeams = [];
    try {
      if (fs.existsSync(teamsFile)) localTeams = JSON.parse(fs.readFileSync(teamsFile));
      else fs.writeFileSync(teamsFile, JSON.stringify([]));
    } catch {
      fs.writeFileSync(teamsFile, JSON.stringify([]));
      localTeams = [];
    }

    // ===== COMANDOS =====
    if (text === "/list") {
      await sendMessage(chatId, "📋 Equipos vigilados:\n" + (localTeams.length ? localTeams.join("\n") : "No hay equipos aún"));
    }
    else if (text.startsWith("/add ")) {
      const teamToAdd = text.replace("/add ", "").trim();
      if (!localTeams.includes(teamToAdd)) {
        localTeams.push(teamToAdd);
        fs.writeFileSync(teamsFile, JSON.stringify(localTeams, null, 2));
        await sendMessage(chatId, `✅ ${teamToAdd} añadido`);
      } else await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);
    }
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      localTeams = localTeams.filter(t => t !== teamToRemove);
      fs.writeFileSync(teamsFile, JSON.stringify(localTeams, null, 2));
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);
    }
    else if (text === "/live") {
      const liveMatches = await getLiveMatches();
      await sendMessage(chatId, "🔥 Partidos en directo:\n\n" + liveMatches.join("\n\n"));
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.log("⚠️ Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
