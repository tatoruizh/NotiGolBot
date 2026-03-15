import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const teamsFile = path.join(process.cwd(), "data", "teams.json");
const sentGoalsFile = path.join(process.cwd(), "data/sentGoals.json");
const alertedFile = path.join(process.cwd(), "data/alertedMatches.json");

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

// Cargar partidos alertados
export let alertedMatches = [];
try {
  alertedMatches = JSON.parse(fs.readFileSync(alertedFile));
} catch {
  fs.writeFileSync(alertedFile, JSON.stringify([]));
  alertedMatches = [];
}

// Guardar JSON
export function saveJSON() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  fs.writeFileSync(alertedFile, JSON.stringify(alertedMatches, null, 2));
}

// Enviar mensaje a Telegram
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

// Revisar partidos en directo cada 5 minutos
export async function checkMatches() {
  try {
    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    for (const match of events) {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;
      const matchId = match.id;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const startKey = `start-${matchId}`;
      if (match.status.type === "inprogress" && !alertedMatches.includes(startKey)) {
        await send(`🟢 PARTIDO INICIADO\n${home} vs ${away}`);
        alertedMatches.push(startKey);
      }

      const endKey = `end-${matchId}`;
      if (match.status.type === "finished" && !alertedMatches.includes(endKey)) {
        await send(`🔴 PARTIDO FINALIZADO\n${home} ${match.homeScore.current} - ${match.awayScore.current} ${away}`);
        alertedMatches.push(endKey);
      }

      // Goles en directo
      if (match.events) {
        const goals = match.events.filter(e => e.type === "goal" && !e.cancelled);
        for (const g of goals) {
          const key = `${matchId}-${g.time}-${g.player?.name}`;
          if (sentEvents.includes(key)) continue;
          sentEvents.push(key);
          const isPenalty = g.details?.type === "penalty" ? " (P)" : "";
          await send(`⚽ GOL (${g.time}')${isPenalty}\n${home} ${match.homeScore.current} - ${match.awayScore.current} ${away}\n⚽ ${g.player?.name}`);
        }
      }
    }

    saveJSON();
  } catch (err) {
    console.log("Error SofaScore:", err);
  }
}

// Obtener partidos en directo de tus equipos
export async function getLiveMatches() {
  try {
    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    const liveEvents = events.filter(
      m => teams.includes(m.homeTeam.name) || teams.includes(m.awayTeam.name)
    );

    if (!liveEvents.length) return ["No hay partidos en directo para tus equipos"];

    return liveEvents.map(m => {
      const minute = m.time?.current || 0;
      const homeScore = m.homeScore?.current || 0;
      const awayScore = m.awayScore?.current || 0;
      let msg = `${m.homeTeam.name} ${homeScore} - ${awayScore} ${m.awayTeam.name} (${minute}')`;

      if (m.events) {
        const goals = m.events.filter(e => e.type === "goal" && !e.cancelled);
        for (const g of goals) {
          const isPenalty = g.details?.type === "penalty" ? " (P)" : "";
          msg += `\n⚽ ${g.player?.name} (${g.time}')${isPenalty}`;
        }
      }

      return msg;
    });
  } catch (err) {
    console.log("Error SofaScore /live:", err);
    return ["Error al consultar SofaScore"];
  }
}

// Obtener partidos por fecha
export async function getMatchesByDate(dateStr) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/events/${dateStr}`);
    const data = await res.json();
    const events = data.events || [];

    const filtered = events.filter(
      m => teams.includes(m.homeTeam.name) || teams.includes(m.awayTeam.name)
    );

    if (!filtered.length) return ["No hay partidos para tus equipos"];

    return filtered.map(m => {
      const home = m.homeTeam.name;
      const away = m.awayTeam.name;
      const homeScore = m.homeScore?.current ?? "-";
      const awayScore = m.awayScore?.current ?? "-";
      const status = m.status.type === "finished" ? "✅ Finalizado" :
                     m.status.type === "inprogress" ? `⚽ En curso (${m.time?.current || 0}')` : "🕒 Pendiente";
      return `${home} vs ${away} — ${status} — ${homeScore}-${awayScore}`;
    });
  } catch (err) {
    console.log("Error SofaScore /getMatchesByDate:", err);
    return ["Error al consultar SofaScore"];
  }
}

// Guardar sentGoals.json al cerrar
process.on("exit", saveJSON);
process.on("SIGINT", () => { saveJSON(); process.exit(); });
process.on("SIGTERM", () => { saveJSON(); process.exit(); });

// Ejecutar checkMatches automáticamente
setInterval(checkMatches, 5 * 60 * 1000); // cada 5 min
