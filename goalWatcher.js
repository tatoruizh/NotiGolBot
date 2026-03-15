// goalWatcher.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");
const stateFile = path.join(dataDir, "state.json");

// Estado persistente (partidos detectados, goles marcados, flags)
let state = {};
try { state = JSON.parse(fs.readFileSync(stateFile)); } catch { state = {}; fs.writeFileSync(stateFile, JSON.stringify(state)); }

// Leer equipos vigilados
export function loadTeams() {
  try {
    if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(teamsFile));
  } catch {
    return [];
  }
}

export function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Normalizar nombres para comparar (quita tildes, signos, artículos comunes)
function normalizeName(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, "") // quitar símbolos
    .replace(/\b(fc|cf|club|de|la|el|the|s\.c|sc)\b/g, "") // quitar sufijos/artículos comunes
    .replace(/\s+/g, " ")
    .trim();
}

// Comprueba si un partido (home/away) corresponde a alguno de los equipos vigilados
function matchIsWatched(m, teams) {
  const home = normalizeName(m.homeTeam?.name || "");
  const away = normalizeName(m.awayTeam?.name || "");
  for (const t of teams) {
    const n = normalizeName(t);
    if (!n) continue;
    if (home === n || away === n) return true;
    if (home.includes(n) || away.includes(n)) return true;
    if (n.includes(home) || n.includes(away)) return true;
  }
  return false;
}

// Obtener partidos live / próximos y formatearlos para /live
export async function getLiveMatches() {
  try {
    const teams = loadTeams();
    if (!teams.length) return ["No hay equipos vigilados aún"];

    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();
    const events = data.events || [];

    // Filtrar por equipos vigilados (normalizado)
    const filtered = events.filter(m => matchIsWatched(m, teams));

    if (!filtered.length) {
      // Además: intentar devolver próximos partidos que aparezcan en `events` aunque no estén en live
      return ["No hay partidos en directo para tus equipos"];
    }

    const messages = filtered.map(m => {
      const home = m.homeTeam?.name || "Home";
      const away = m.awayTeam?.name || "Away";
      const homeScore = typeof m.homeScore?.current === "number" ? m.homeScore.current : "-";
      const awayScore = typeof m.awayScore?.current === "number" ? m.awayScore.current : "-";
      const minute = m.time?.current ?? "";
      const statusType = m.status?.type || "";

      const status = statusType === "inprogress" ? `⚽ En curso (${minute}')`
                    : statusType === "notstarted" ? `🕒 Próximo`
                    : statusType === "finished" ? `✅ Finalizado`
                    : statusType;

      let msg = `${home} ${homeScore} - ${awayScore} ${away} — ${status}`;

      // Si SofaScore incluye eventos en el objeto match, añadimos goleadores
      if (Array.isArray(m.events) && m.events.length) {
        const goals = m.events.filter(e => e.type === "goal" && !e.cancelled);
        if (goals.length) {
          msg += "\n";
          goals.forEach(g => {
            const pen = g.details?.type === "penalty" ? " (P)" : "";
            const player = g.player?.name || "Jugador";
            msg += `⚽ ${player} (${g.time}')${pen}\n`;
          });
          msg = msg.trim();
        }
      }

      return msg;
    });

    return messages;
  } catch (err) {
    console.log("goalWatcher.getLiveMatches error:", err);
    return ["Error al consultar SofaScore"];
  }
}

// Watcher: detectar goles, HT y final (se usa desde index.js con interval)
export async function checkMatchesAndNotify(sendFn) {
  try {
    const teams = loadTeams();
    if (!teams.length) return;

    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();
    const events = data.events || [];

    for (const m of events) {
      if (!matchIsWatched(m, teams)) continue;

      const matchId = m.id;
      const home = m.homeTeam?.name || "Home";
      const away = m.awayTeam?.name || "Away";
      const status = m.status?.type || "";

      // inicializar estado local para el partido
      if (!state[matchId]) {
        state[matchId] = { goals: new Set(), halftime: false, finished: false, detected: true };
        // enviar inicio solo si está en progreso
        if (status === "inprogress") {
          await sendFn(`🟢 PARTIDO INICIADO\n\n${home} vs ${away}`);
        }
      }

      // incidents: consultar para obtener goles con minute + player
      try {
        const incRes = await fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`);
        const incData = await incRes.json();
        const incidents = incData.incidents || [];

        for (const inc of incidents) {
          if (inc.incidentType !== "goal") continue;
          const minute = inc.time;
          const player = inc.player?.name || "Jugador";
          const key = `${matchId}-${minute}-${player}`;
          if (state[matchId].goals.has(key)) continue;
          // nuevo gol
          state[matchId].goals.add(key);

          const homeScore = m.homeScore?.current ?? "-";
          const awayScore = m.awayScore?.current ?? "-";
          const pen = inc.details?.type === "penalty" ? " (P)" : "";

          const msg =
`⚽ GOL ${minute}'

${home} ${homeScore} - ${awayScore} ${away}

⚽ ${player}${pen}`;

          await sendFn(msg);
        }

      } catch (e) {
        // si falla incidents no detenemos el watcher
        // consola para debug
        // console.log("incidents fetch error", e);
      }

      // halftime
      if (status === "halftime" && !state[matchId].halftime) {
        const homeScore = m.homeScore?.current ?? "-";
        const awayScore = m.awayScore?.current ?? "-";
        await sendFn(`⏱ DESCANSO\n\n${home} ${homeScore} - ${awayScore} ${away}`);
        state[matchId].halftime = true;
      }

      // final
      if (status === "finished" && !state[matchId].finished) {
        const homeScore = m.homeScore?.current ?? "-";
        const awayScore = m.awayScore?.current ?? "-";
        await sendFn(`🏁 FINAL DEL PARTIDO\n\n${home} ${homeScore} - ${awayScore} ${away}`);
        state[matchId].finished = true;
      }
    }

    // limpiar partidos que ya no aparezcan (optional): si un partido finalizado no aparece en events, keep it for history
    saveState();
  } catch (err) {
    console.log("goalWatcher.checkMatchesAndNotify error:", err);
  }
}
