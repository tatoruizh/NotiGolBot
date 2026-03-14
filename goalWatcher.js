import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TSDB_KEY = process.env.THESPORTSDB_KEY;

const teamsFile = path.join(process.cwd(), "data", "teams.json");
const sentGoalsFile = path.join(process.cwd(), "data/sentGoals.json");

// ==========================
// Cargar equipos vigilados
// ==========================
let teams = [];
try {
  teams = JSON.parse(fs.readFileSync(teamsFile));
} catch {
  fs.writeFileSync(teamsFile, JSON.stringify([]));
  teams = [];
}

// ==========================
// Cargar goles enviados
// ==========================
let sentEvents = [];
try {
  sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
} catch {
  fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
  sentEvents = [];
}

// ==========================
// Enviar mensaje a Telegram
// ==========================
async function send(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
  } catch (err) {
    console.log("Error enviando mensaje:", err);
  }
}

// ==========================
// Revisar partidos en directo (últimos eventos por liga)
// ==========================
export async function checkMatches() {
  try {
    if (!TSDB_KEY) return;

    // Para cada equipo vigilado se puede iterar; aquí ejemplo con Premier League
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventslast.php?id=4328`);
    const data = await res.json();
    const events = data.results || [];

    for (const match of events) {
      const home = match.strHomeTeam;
      const away = match.strAwayTeam;
      const matchId = match.idEvent;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const homeScore = match.intHomeScore ?? 0;
      const awayScore = match.intAwayScore ?? 0;

      const goalKey = `goal_${matchId}_${homeScore}_${awayScore}`;

      if (!sentEvents.includes(goalKey)) {
        sentEvents.push(goalKey);
        const msg = `⚽ Resultado actualizado\n${home} ${homeScore} - ${awayScore} ${away}`;
        await send(msg);
      }
    }

    fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));

  } catch (err) {
    console.log("Error TheSportsDB:", err);
  }
}

// ==========================
// Obtener partidos por fecha
// ==========================
export async function getMatchesByDate(dateStr) {
  try {
    if (!TSDB_KEY) return ["No se puede consultar, falta TSDB_KEY"];

    // Se puede parametrizar por liga o por cada equipo
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventsday.php?d=${dateStr}&l=English_Premier_League`
    );
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => teams.includes(m.strHomeTeam) || teams.includes(m.strAwayTeam))
      .map(m => {
        const localTime = m.strTime || "TBD";
        return `${m.strHomeTeam} vs ${m.strAwayTeam} — ${m.strLeague} — ${localTime}`;
      });

    return matches.length ? matches : ["No hay partidos para tus equipos"];
  } catch (err) {
    console.log("Error TheSportsDB /getMatchesByDate:", err);
    return ["Error al consultar TheSportsDB"];
  }
}

// ==========================
// Guardar sentGoals.json al cerrar
// ==========================
function saveSentEvents() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
}

process.on("exit", saveSentEvents);
process.on("SIGINT", () => { saveSentEvents(); process.exit(); });
process.on("SIGTERM", () => { saveSentEvents(); process.exit(); });

// ==========================
// Auto-check cada minuto
// ==========================
setInterval(checkMatches, 60000);
