import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const teamsFile = path.join(process.cwd(), "data", "teams.json");
const BOT_TOKEN = process.env.BOT_TOKEN;

function loadTeams() {
  return JSON.parse(fs.readFileSync(teamsFile));
}

function saveTeams(teams) {
  fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
}

async function send(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
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

    // ✅ Ignorar mensajes normales del grupo
    if (!text.startsWith("/")) {
      res.writeHead(200);
      return res.end("ok");
    }

    let teams = loadTeams();

    // ===== LIST =====
    if (text === "/list") {

      const msg = teams.length
        ? "📋 Equipos vigilados:\n\n" + teams.join("\n")
        : "No hay equipos vigilados aún";

      await send(chatId, msg);
    }

    // ===== ADD =====
    else if (text.startsWith("/add ")) {

      const team = text.replace("/add ", "").trim();

      if (!teams.includes(team)) {

        teams.push(team);
        saveTeams(teams);

        await send(chatId, `✅ ${team} añadido`);

      } else {

        await send(chatId, "⚠️ Ese equipo ya está en la lista");
      }
    }

    // ===== REMOVE =====
    else if (text.startsWith("/remove ")) {

      const team = text.replace("/remove ", "").trim();

      teams = teams.filter(t => t !== team);

      saveTeams(teams);

      await send(chatId, `🗑️ ${team} eliminado`);
    }

    // ===== LIVE MATCHES =====
    else if (text === "/live") {

      const resp = await fetch(
        "https://api.sofascore.com/api/v1/sport/football/events/live"
      );

      const data = await resp.json();
      const events = data.events || [];

      const matches = events.filter(m =>
        teams.includes(m.homeTeam.name) ||
        teams.includes(m.awayTeam.name)
      );

      if (!matches.length) {

        await send(chatId, "⚽ No hay partidos en directo de tus equipos");

      } else {

        let msg = "🔴 PARTIDOS EN DIRECTO\n\n";

        for (const m of matches) {

          const home = m.homeTeam.name;
          const away = m.awayTeam.name;

          const hs = m.homeScore?.current ?? 0;
          const as = m.awayScore?.current ?? 0;

          const minute = m.time?.current ?? "";

          msg += `${home} ${hs} - ${as} ${away} (${minute}')\n`;
        }

        await send(chatId, msg);
      }
    }

    // ===== HELP =====
    else {

      await send(
        chatId,
`Comandos disponibles:

/add equipo
/remove equipo
/list
/live`
      );
    }

    res.writeHead(200);
    res.end("ok");

  } catch (err) {

    console.log("Command error:", err);

    res.writeHead(200);
    res.end("ok");
  }
}
