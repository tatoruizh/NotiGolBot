// api/command.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getLiveMatches } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");
const BOT_TOKEN = process.env.BOT_TOKEN;

function ensureTeamsFile() {
  if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));
}

function loadTeams() {
  ensureTeamsFile();
  return JSON.parse(fs.readFileSync(teamsFile));
}
function saveTeams(t) {
  fs.writeFileSync(teamsFile, JSON.stringify(t, null, 2));
}

async function send(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (err) {
    console.log("api/command send error:", err);
  }
}

export default async function handler(req, res) {
  try {
    // leer body de forma segura
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try { body = JSON.parse(raw); } catch (e) { body = {}; }

    const chatId = body?.message?.chat?.id;
    let text = body?.message?.text?.trim();

    if (!chatId || !text) {
      res.writeHead(200); res.end("ok"); return;
    }

    // Ignorar si no es comando
    if (!text.startsWith("/")) { res.writeHead(200); res.end("ok"); return; }

    // Limpiar @BotName en grupos: "/live@NotiGolBot" -> "/live"
    if (text.includes("@")) {
      const parts = text.split(" ");
      parts[0] = parts[0].split("@")[0];
      text = parts.join(" ");
    }

    let teams = loadTeams();

    // /list
    if (text === "/list") {
      const msg = teams.length ? "📋 Equipos vigilados:\n\n" + teams.join("\n") : "No hay equipos vigilados aún";
      await send(chatId, msg);
      res.writeHead(200); res.end("ok"); return;
    }

    // /add ...
    if (text.startsWith("/add ")) {
      const team = text.replace("/add ", "").trim();
      if (!team) { await send(chatId, "Especifica el equipo: /add Nombre Equipo"); res.writeHead(200); res.end("ok"); return; }
      if (!teams.includes(team)) {
        teams.push(team); saveTeams(teams);
        await send(chatId, `✅ ${team} añadido`);
      } else {
        await send(chatId, `⚠️ ${team} ya estaba en la lista`);
      }
      res.writeHead(200); res.end("ok"); return;
    }

    // /remove ...
    if (text.startsWith("/remove ")) {
      const team = text.replace("/remove ", "").trim();
      teams = teams.filter(t => t !== team); saveTeams(teams);
      await send(chatId, `🗑️ ${team} eliminado`);
      res.writeHead(200); res.end("ok"); return;
    }

    // /live
    if (text === "/live") {
      // obtener live matches (ya filtra por equipos vigilados)
      const lines = await getLiveMatches();
      // build single message (limit Telegram ~4096 chars)
      const msg = lines.length ? ("🔴 PARTIDOS EN DIRECTO\n\n" + lines.join("\n\n")) : "⚽ No hay partidos en directo para tus equipos";
      await send(chatId, msg);
      res.writeHead(200); res.end("ok"); return;
    }

    // help por defecto
    await send(chatId, "Comandos:\n/add Equipo\n/remove Equipo\n/list\n/live");
    res.writeHead(200); res.end("ok");
  } catch (err) {
    console.log("api/command error:", err);
    try { res.writeHead(200); res.end("ok"); } catch {}
  }
}
