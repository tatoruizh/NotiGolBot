import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

// ==========================
// Helper para leer equipos
// ==========================
function readTeams() {
  try {
    if (fs.existsSync(teamsFile)) return JSON.parse(fs.readFileSync(teamsFile));
    fs.writeFileSync(teamsFile, JSON.stringify([]));
    return [];
  } catch {
    fs.writeFileSync(teamsFile, JSON.stringify([]));
    return [];
  }
}

// ==========================
// Helper para escribir equipos
// ==========================
function writeTeams(teams) {
  fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
}

// ==========================
// Función para enviar mensaje
// ==========================
async function sendMessage(chatId, msg) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN || !chatId || !msg) return;
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

// ==========================
// Handler principal
// ==========================
export default async function handler(req, res) {
  try {
    // ===== Leer body POST correctamente =====
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

    // ==========================
    // Comandos
    // ==========================
    let teams = readTeams();

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
        writeTeams(teams);
        await sendMessage(chatId, `✅ ${teamToAdd} añadido`);
      } else {
        await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);
      }
    }

    // REMOVE
    else if (text.startsWith("/remove ")) {
      const teamToRemove = text.replace("/remove ", "").trim();
      teams = teams.filter(t => t !== teamToRemove);
      writeTeams(teams);
      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);
    }

    // TODAY / TOMORROW
    else if (text === "/today" || text === "/tomorrow") {
      const date = new Date();
      if (text === "/tomorrow") date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().split("T")[0];

      const matches = await getMatchesByDate(dateStr);
      const msg = `⚽ Partidos ${text === "/today" ? "de hoy" : "de mañana"}:\n\n${matches.join("\n")}`;
      await sendMessage(chatId, msg);
    }

    return res.status(200).send("ok");

  } catch (err) {
    console.log("⚠️ Error en command handler:", err);
    return res.status(200).send("ok");
  }
}
