import { teams, liveMatches, getMatchesByDate, saveJSON } from "../goalWatcher.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

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
    if (!text || !text.startsWith("/")) return res.status(200).send("ok");

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) return res.status(200).send("ok");

    async function send(msg) {
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
    if (text === "/list") {
      await send("📋 Equipos vigilados:\n" + (teams.length ? teams.join("\n") : "No hay equipos aún"));
    }
    else if (text.startsWith("/add ")) {
      const team = text.replace("/add ", "").trim();
      if (!teams.includes(team)) {
        teams.push(team);
        saveJSON();
        await send(`✅ ${team} añadido`);
      } else await send(`⚠️ ${team} ya estaba en la lista`);
    }
    else if (text.startsWith("/remove ")) {
      const team = text.replace("/remove ", "").trim();
      const index = teams.findIndex(t => t.toLowerCase() === team.toLowerCase());
      if (index > -1) {
        teams.splice(index, 1);
        saveJSON();
        await send(`🗑️ ${team} eliminado`);
      } else await send(`⚠️ ${team} no estaba en la lista`);
    }
    else if (text === "/today" || text === "/tomorrow") {
      const date = new Date();
      if (text === "/tomorrow") date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().split("T")[0];
      const matches = await getMatchesByDate(dateStr);
      await send(`⚽ Partidos ${text === "/today" ? "de hoy" : "de mañana"}:\n\n${matches.join("\n")}`);
    }
    else if (text === "/live") {
      if (liveMatches.length === 0) {
        await send("No hay partidos en directo de tus equipos ahora mismo ⚽");
      } else {
        const lines = liveMatches.map(m =>
          `${m.home} ${m.homeScore} - ${m.awayScore} ${m.away} (${m.minute}') — ${m.tournament}`
        );
        await send("🔥 Partidos en directo:\n\n" + lines.join("\n"));
      }
    }

    return res.status(200).send("ok");

  } catch (err) {
    console.log("Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
