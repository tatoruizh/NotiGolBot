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
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
  } catch (e) {
    console.log("Telegram error:", e);
  }
}

async function checkMatches() {
  try {
    const teams = loadTeams();
    if (!teams.length) return;

    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();
    const events = data.events || [];

    const state = loadState();

    for (const m of events) {
      const home = m.homeTeam.name;
      const away = m.awayTeam.name;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const id = m.id;
      const homeScore = m.homeScore?.current || 0;
      const awayScore = m.awayScore?.current || 0;

      const score = `${homeScore}-${awayScore}`;

      if (!state[id]) {
        state[id] = { score };
        await send(`🟢 PARTIDO DETECTADO\n${home} vs ${away}`);
      } else if (state[id].score !== score) {
        state[id].score = score;
        await send(`⚽ GOL\n${home} ${homeScore} - ${awayScore} ${away}`);
      }
    }

    saveState(state);

  } catch (err) {
    console.log("Watcher error:", err);
  }
}

// revisar cada minuto
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
    console.log(err);
    res.writeHead(500);
    res.end("Error");
  }
});

server.listen(PORT, () => {
  console.log(`Bot iniciado en puerto ${PORT}`);
});
