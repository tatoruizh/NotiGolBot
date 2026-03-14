// goalWatcher.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TSDB_KEY = process.env.THESPORTSDB_KEY;

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");

// Cargar equipos
export let teams = [];
try {
  teams = JSON.parse(fs.readFileSync(teamsFile));
} catch {
  fs.writeFileSync(teamsFile, JSON.stringify([]));
  teams = [];
}

// Cargar eventos enviados
export let sentEvents = [];
try {
  sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
} catch {
  fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
  sentEvents = [];
}

// Guardar JSON
export function saveJSON() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
}

// Función para enviar mensaje a Telegram
async function send(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
  } catch (err) {
    console.log("⚠️ Error enviando mensaje:", err);
  }
}

// Revisión periódica de partidos y goles
export async function checkMatches() {
  try {
    if (!TSDB_KEY) return;

    // ⚽ Obtener últimos partidos de la liga o equipo
    const leagueId = 4328; // ejemplo: Premier League
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventslast.php?id=${leagueId}`);
    const data = await res.json();
    const events = data.results || [];

    for (const match of events) {
      const home = match.strHomeTeam;
      const away = match.strAwayTeam;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const homeScore = match.intHomeScore || 0;
      const awayScore = match.intAwayScore || 0;
      const matchId = match.idEvent;

      const goalKey = `goal_${matchId}_${homeScore}_${awayScore}`;

      if (!sentEvents.includes(goalKey)) {
        sentEvents.push(goalKey);
        const msg = `⚽ Resultado actualizado\n${home} ${homeScore} - ${awayScore} ${away}`;
        await send(msg);
      }
    }

    saveJSON();
  } catch (err) {
    console.log("⚠️ Error checkMatches:", err);
  }
}

// Ejecutar cada minuto
setInterval(checkMatches, 60000);

// Obtener partidos por fecha para /today y /tomorrow
export async function getMatchesByDate(dateStr) {
  try {
    if (!TSDB_KEY) return ["No se puede consultar, falta TSDB_KEY"];

    // ⚽ TheSportsDB: eventos por día
    // Aquí puedes cambiar la liga por la que quieras
    const leagueName = "English Premier League";
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventsday.php?d=${dateStr}&l=${encodeURIComponent(leagueName)}`
    );
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => teams.includes(m.strHomeTeam) || teams.includes(m.strAwayTeam))
      .map(m => {
        const time = m.strTime || "TBD";
        return `${m.strHomeTeam} vs ${m.strAwayTeam} — ${m.strLeague} — ${time}`;
      });

    return matches.length ? matches : ["No hay partidos para tus equipos"];
  } catch (err) {
    console.log("⚠️ Error getMatchesByDate:", err);
    return ["Error al consultar TheSportsDB"];
  }
}

// Guardar eventos al cerrar el proceso
process.on("exit", saveJSON);
process.on("SIGINT", () => { saveJSON(); process.exit(); });
process.on("SIGTERM", () => { saveJSON(); process.exit(); });
