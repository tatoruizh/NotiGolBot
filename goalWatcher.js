import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("⚠️ BOT_TOKEN o CHAT_ID no definidos. El bot no enviará mensajes.");
}

// Carpetas y archivos
const dataDir = path.resolve("./data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");

// Cargar equipos
let teams = [];
try {
  if (fs.existsSync(teamsFile)) {
    teams = JSON.parse(fs.readFileSync(teamsFile));
  } else {
    fs.writeFileSync(teamsFile, JSON.stringify([]));
  }
} catch (err) {
  console.log("Error leyendo teams.json, se creará uno nuevo:", err);
  fs.writeFileSync(teamsFile, JSON.stringify([]));
}

// Cargar sentGoals.json
let sentEvents = [];
try {
  if (fs.existsSync(sentGoalsFile)) {
    sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
  } else {
    fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
  }
} catch (err) {
  console.log("Error leyendo sentGoals.json, se creará uno nuevo:", err);
  fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
}

// Función para enviar mensaje a Telegram
async function send(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
  } catch (err) {
    console.log("Error enviando mensaje a Telegram:", err);
  }
}

// Revisar partidos en directo y enviar alertas
export async function checkMatches() {
  try {
    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    for (const match of events) {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;

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

// Revisar automáticamente cada 45 segundos solo si BOT_TOKEN y CHAT_ID están definidos
if (BOT_TOKEN && CHAT_ID) {
  setInterval(checkMatches, 45000);
}

// Función para obtener partidos por fecha (para /today y /tomorrow)
export async function getMatchesByDate(dateStr) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled/${dateStr}`);
    const data = await res.json();
    const events = data.events || [];

    const matches = events
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

// Guardar sentGoals.json al cerrar el proceso
function saveSentEvents() {
  try {
    fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  } catch (err) {
    console.log("Error guardando sentGoals.json al cerrar:", err);
  }
}

process.on("exit", saveSentEvents);
process.on("SIGINT", () => { saveSentEvents(); process.exit(); });
process.on("SIGTERM", () => { saveSentEvents(); process.exit(); });
