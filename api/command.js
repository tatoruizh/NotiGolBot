import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const teamsFile = path.join(process.cwd(), "data", "teams.json");
const BOT_TOKEN = process.env.BOT_TOKEN;

function loadTeams() {
  return JSON.parse(fs.readFileSync(teamsFile));
}

function saveTeams(t) {
  fs.writeFileSync(teamsFile, JSON.stringify(t, null, 2));
}

async function send(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

export default async function handler(req, res) {
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);

    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text?.trim();

    if (!chatId || !text) {
      res.writeHead(200);
      return res.end("ok");
    }

    let teams = loadTeams();

    if (text === "/list") {
      const msg = teams.length
        ? "📋 Equipos vigilados:\n" + teams.join("\n")
        : "No hay equipos aún";
      await send(chatId, msg);
    }

    else if (text.startsWith("/add ")) {
      const t = text.replace("/add ", "").trim();
      if (!teams.includes(t)) {
        teams.push(t);
        saveTeams(teams);
        await send(chatId, `✅ ${t} añadido`);
      } else {
        await send(chatId, "Ese equipo ya está en la lista");
      }
    }

    else if (text.startsWith("/remove ")) {
      const t = text.replace("/remove ", "").trim();
      teams = teams.filter(x => x !== t);
      saveTeams(teams);
      await send(chatId, `🗑️ ${t} eliminado`);
    }

    else {
      await send(chatId, "Comandos:\n/add equipo\n/remove equipo\n/list");
    }

    res.writeHead(200);
    res.end("ok");

  } catch (err) {
    console.log("Command error:", err);
    res.writeHead(200);
    res.end("ok");
  }
}
