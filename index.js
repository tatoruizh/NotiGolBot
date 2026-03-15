import http from "http";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import handler from "./api/command.js";

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const dataDir = path.join(process.cwd(), "data");
const teamsFile = path.join(dataDir, "teams.json");
const stateFile = path.join(dataDir, "state.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));
if (!fs.existsSync(stateFile)) fs.writeFileSync(stateFile, JSON.stringify({}));

function loadTeams() {
  return JSON.parse(fs.readFileSync(teamsFile));
}

function loadState() {
  return JSON.parse(fs.readFileSync(stateFile));
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function send(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text
      })
    });
  } catch (err) {
    console.log("Telegram error:", err);
  }
}

async function checkMatches() {
  try {

    const teams = loadTeams();
    if (!teams.length) return;

    const resp = await fetch(
      "https://api.sofascore.com/api/v1/sport/football/events/live"
    );

    const data = await resp.json();
    const events = data.events || [];

    const state = loadState();

    for (const m of events) {

      const home = m.homeTeam.name;
      const away = m.awayTeam.name;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const matchId = m.id;

      if (!state[matchId]) {
        state[matchId] = { goals: [] };

        await send(
`🟢 PARTIDO INICIADO

${home} vs ${away}`
        );
      }

      const incidentsResp = await fetch(
        `https://api.sofascore.com/api/v1/event/${matchId}/incidents`
      );

      const incidentsData = await incidentsResp.json();
      const incidents = incidentsData.incidents || [];

      for (const inc of incidents) {

        if (inc.incidentType !== "goal") continue;

        const minute = inc.time;
        const scorer = inc.player?.name || "Jugador";

        const key = `${matchId}-${minute}-${scorer}`;

        if (state[matchId].goals.includes(key)) continue;

        state[matchId].goals.push(key);

        const homeScore = m.homeScore?.current ?? 0;
        const awayScore = m.awayScore?.current ?? 0;

        const msg =
`⚽ GOL ${minute}'

${home} ${homeScore} - ${awayScore} ${away}

⚽ ${scorer}`;

        await send(msg);
      }
    }

    saveState(state);

  } catch (err) {
    console.log("Watcher error:", err);
  }
}

// comprobar cada minuto
setInterval(checkMatches, 60000);

const server = http.createServer(async (req, res) => {

  try {

    if (req.method === "POST" && req.url.startsWith("/api/command")) {
      await handler(req, res);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot activo ✅");

  } catch (err) {

    console.log("Server error:", err);

    res.writeHead(500);
    res.end("Error servidor");
  }
});

server.listen(PORT, () => {
  console.log(`Bot iniciado en puerto ${PORT}`);
});
