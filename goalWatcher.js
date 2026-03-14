import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Archivos JSON
const teamsFile = path.join(process.cwd(), "data", "teams.json");
const sentGoalsFile = path.join(process.cwd(), "data", "sentGoals.json");

// Cargar equipos
let teams = [];
try {
  teams = JSON.parse(fs.readFileSync(teamsFile));
} catch {
  fs.writeFileSync(teamsFile, JSON.stringify([]));
  teams = [];
}

// Cargar sentGoals.json
let sentEvents = [];
try {
  sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
} catch {
  fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
  sentEvents = [];
}

// ===== función para enviar mensaje a Telegram =====
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

// ===== revisar partidos en directo cada 45s =====
export async function checkMatches() {
  try {
    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    for (const match of events) {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;

      // Filtrar solo equipos vigilados
      if (!teams.includes(home) && !teams.includes(away)) continue;

      const tournament = match.tournament.name;
      const minute = match.time?.current || 0;
      const homeScore = match.homeScore?.current || 0;
      const awayScore = match.awayScore?.current || 0;

      const matchKey = `match_${match.id}`;
      const finalKey = `final_${match.id}`;
      const goalKey = `goal_${match.id}_${homeScore}_${awayScore}`;

      // 🟢 INICIO PARTIDO
      if (!sentEvents.includes(matchKey) && minute <= 1) {
        sentEvents.push(matchKey);
        await send(`🟢 INICIO DE PARTIDO\n🏆 ${tournament}\n\n${home} vs ${away}`);
      }

      // ⚽ GOLES
      if (!sentEvents.includes(goalKey) && match.events) {
        const goals = match.events.filter(e => e.type === "goal" && !e.cancelled);
        const lastGoal = goals[goals.length - 1];
        if (lastGoal) {
          const scorer = lastGoal.player?.name || "Desconocido";
          const isPenalty = lastGoal.details?.type === "penalty" ? " (P)" : "";
          const goalText = `⚽ GOOOOOL (${minute}')${isPenalty}\n🏆 ${tournament}\n${scorer}\n\n${home} ${homeScore} - ${awayScore} ${away}`;
          sentEvents.push(goalKey);
          await send(goalText);
        }
      }

      // 🔴 FINAL PARTIDO
      if (match.status?.type === "finished" && !sentEvents.includes(finalKey)) {
        sentEvents.push(finalKey);
        await send(`🔴 FINAL DEL PARTIDO\n🏆 ${tournament}\n\n${home} ${homeScore} - ${awayScore} ${away}`);
      }
    }

    fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  } catch (err) {
    console.log("Error SofaScore:", err);
  }
}

setInterval(checkMatches, 45000);

// ===== obtener partidos por fecha para /today y /tomorrow =====
export async function getMatchesByDate(dateStr) {
  try {
    const startDate = new Date(dateStr + "T00:00:00Z").getTime();
    const endDate = new Date(dateStr + "T23:59:59Z").getTime();

    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => {
        const startTime = new Date(m.startingAt).getTime();
        return startTime >= startDate && startTime <= endDate;
      })
      .filter(m => teams.includes(m.homeTeam.name) || teams.includes(m.awayTeam.name))
      .map(m => {
        const localTime = new Date(m.startingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${m.homeTeam.name} vs ${m.awayTeam.name} — ${m.tournament.name} — ${localTime}`;
      });

    if (matches.length === 0) return ["No hay partidos para tus equipos"];
    return matches;
  } catch (err) {
    console.log("Error al obtener partidos por fecha:", err);
    return ["Error al consultar SofaScore"];
  }
}

// ===== guardar sentGoals.json al cerrar proceso =====
function saveSentEvents() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
}

process.on("exit", saveSentEvents);
process.on("SIGINT", () => { saveSentEvents(); process.exit(); });
process.on("SIGTERM", () => { saveSentEvents(); process.exit(); });
