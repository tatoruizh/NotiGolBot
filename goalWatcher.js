import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const dataDir = path.join(process.cwd(), "data");
const teamsFile = path.join(dataDir, "teams.json");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");

// ======================
// 🔹 Datos en memoria
// ======================
export let teams = [];
export let sentEvents = [];
export let liveMatches = []; // partidos en directo para /live

// ======================
// 🔹 Cargar archivos JSON
// ======================
function loadJSON(file, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    fs.writeFileSync(file, JSON.stringify(defaultValue));
    return defaultValue;
  }
}

teams = loadJSON(teamsFile, []);
sentEvents = loadJSON(sentGoalsFile, []);

// ======================
// 🔹 Guardar JSON
// ======================
export function saveJSON() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
}

// ======================
// 🔹 Enviar mensaje a Telegram
// ======================
async function sendMessage(text) {
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

// ======================
// 🔹 Utilidad: equipo vigilado
// ======================
function isTeamWatched(team) {
  return teams.some(t => t.toLowerCase() === team.toLowerCase());
}

// ======================
// 🔹 Revisar partidos en directo y goles
// ======================
export async function checkMatches() {
  try {
    const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await res.json();
    const events = data.events || [];

    liveMatches = []; // reset de partidos en directo

    for (const match of events) {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;
      const matchId = match.id;

      // Filtrar solo equipos vigilados
      if (!isTeamWatched(home) && !isTeamWatched(away)) continue;

      // Guardar partido en vivo para /live
      liveMatches.push({
        home,
        away,
        homeScore: match.homeScore?.current ?? 0,
        awayScore: match.awayScore?.current ?? 0,
        minute: match.time?.current ?? 0,
        tournament: match.tournament?.name ?? "Desconocido"
      });

      // 🔹 Alertas de goles
      const incidentsResp = await fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`);
      const incidentsData = await incidentsResp.json();
      const incidents = incidentsData.incidents || [];

      for (const inc of incidents) {
        if (inc.incidentType === "goal") {
          const scorer = inc.player?.name || "Desconocido";
          const minute = inc.time ?? "?";
          const key = `${matchId}-${minute}-${scorer}`;

          if (!sentEvents.includes(key)) {
            sentEvents.push(key);

            const isPenalty = inc.details?.type === "penalty" ? " (P)" : "";
            const msg = `⚽ GOL (${minute}')${isPenalty}\n${home} ${match.homeScore?.current ?? 0} - ${match.awayScore?.current ?? 0} ${away}\n⚽ ${scorer}`;
            await sendMessage(msg);
          }
        }
      }
    }

    // Guardar cambios en disco
    saveJSON();

  } catch (err) {
    console.log("Error checkMatches:", err);
  }
}

// ======================
// 🔹 Obtener partidos por fecha (/today y /tomorrow)
// ======================
export async function getMatchesByDate(dateStr) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/events/scheduled/${dateStr}`);
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => isTeamWatched(m.homeTeam.name) || isTeamWatched(m.awayTeam.name))
      .map(m => {
        const localTime = new Date(m.startingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${m.homeTeam.name} vs ${m.awayTeam.name} — ${m.tournament.name} — ${localTime}`;
      });

    return matches.length ? matches : ["No hay partidos para tus equipos"];
  } catch (err) {
    console.log("Error getMatchesByDate:", err);
    return ["Error consultando SofaScore"];
  }
}

// ======================
// 🔹 Ejecutar watcher cada 5 min
// ======================
setInterval(checkMatches, 300000); // 5 minutos
