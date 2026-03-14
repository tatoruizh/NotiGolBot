import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");

// Archivos JSON
export const teamsFile = path.join(dataDir, "teams.json");
export const sentGoalsFile = path.join(dataDir, "sentGoals.json");
export const alertedFile = path.join(dataDir, "alertedMatches.json");

// Cargar equipos
export let teams = [];
try {
  teams = JSON.parse(fs.readFileSync(teamsFile));
} catch {
  fs.writeFileSync(teamsFile, JSON.stringify([]));
  teams = [];
}

// Cargar sentGoals.json
export let sentEvents = [];
try {
  sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
} catch {
  fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
  sentEvents = [];
}

// Cargar alertedMatches.json
export let alertedMatches = [];
try {
  alertedMatches = JSON.parse(fs.readFileSync(alertedFile));
} catch {
  fs.writeFileSync(alertedFile, JSON.stringify([]));
  alertedMatches = [];
}

// Guardar JSONs
export function saveJSON() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  fs.writeFileSync(alertedFile, JSON.stringify(alertedMatches, null, 2));
}

// Enviar mensaje a Telegram
async function send(text) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
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

// Revisar partidos en directo cada minuto
export async function checkMatches() {
  const TSDB_KEY = process.env.THESPORTSDB_KEY;
  if (!TSDB_KEY) return;

  try {
    for (const team of teams) {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventslast.php?t=${encodeURIComponent(team)}`);
      const data = await res.json();
      const events = data.results || [];

      for (const match of events) {
        const home = match.strHomeTeam;
        const away = match.strAwayTeam;
        const matchId = match.idEvent;

        if (!teams.includes(home) && !teams.includes(away)) continue;

        // 🟢 PARTIDO INICIADO
        const startKey = `start-${matchId}`;
        if (!alertedMatches.includes(startKey)) {
          await send(`🟢 PARTIDO INICIADO\n${home} vs ${away}`);
          alertedMatches.push(startKey);
        }

        // 🔴 PARTIDO FINALIZADO
        const endKey = `end-${matchId}`;
        if (!alertedMatches.includes(endKey) && match.intHomeScore !== null) {
          await send(`🔴 PARTIDO FINALIZADO\n${home} ${match.intHomeScore} - ${match.intAwayScore} ${away}`);
          alertedMatches.push(endKey);
        }

        // ⚽ GOLES (simulado con score)
        const goalKey = `goal_${matchId}_${match.intHomeScore}_${match.intAwayScore}`;
        if (!sentEvents.includes(goalKey) && match.intHomeScore !== null) {
          sentEvents.push(goalKey);
          await send(`⚽ Resultado actualizado\n${home} ${match.intHomeScore} - ${match.intAwayScore} ${away}`);
        }
      }
    }

    saveJSON();
  } catch (err) {
    console.log("Error TheSportsDB checkMatches:", err);
  }
}

// Obtener partidos por fecha (para /today y /tomorrow)
export async function getMatchesByDate(dateStr) {
  const TSDB_KEY = process.env.THESPORTSDB_KEY;
  if (!TSDB_KEY) return ["No se puede consultar, falta TSDB_KEY"];

  try {
    // Ejemplo: iterar sobre equipos para ver partidos del día
    let matches = [];

    for (const team of teams) {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventsday.php?d=${dateStr}&t=${encodeURIComponent(team)}`);
      const data = await res.json();
      const events = data.events || [];

      matches = matches.concat(
        events
          .filter(m => teams.includes(m.strHomeTeam) || teams.includes(m.strAwayTeam))
          .map(m => {
            const localTime = m.strTime || "TBD";
            return `${m.strHomeTeam} vs ${m.strAwayTeam} — ${m.strLeague} — ${localTime}`;
          })
      );
    }

    return matches.length ? matches : ["No hay partidos para tus equipos"];
  } catch (err) {
    console.log("Error TheSportsDB getMatchesByDate:", err);
    return ["Error al consultar TheSportsDB"];
  }
}

// Guardar JSON al cerrar el proceso
process.on("exit", saveJSON);
process.on("SIGINT", () => { saveJSON(); process.exit(); });
process.on("SIGTERM", () => { saveJSON(); process.exit(); });

// Iniciar vigilancia automática
setInterval(checkMatches, 60000);
