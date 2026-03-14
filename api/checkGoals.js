import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Archivos JSON
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");
const alertedFile = path.join(dataDir, "alertedMatches.json");

// Inicializar JSON si no existen
if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));
if (!fs.existsSync(sentGoalsFile)) fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
if (!fs.existsSync(alertedFile)) fs.writeFileSync(alertedFile, JSON.stringify([]));

// Cargar datos
let EQUIPOS = [];
let GOLES_ENVIADOS = [];
let PARTIDOS_ALERTADOS = [];

try {
  EQUIPOS = JSON.parse(fs.readFileSync(teamsFile));
  GOLES_ENVIADOS = JSON.parse(fs.readFileSync(sentGoalsFile));
  PARTIDOS_ALERTADOS = JSON.parse(fs.readFileSync(alertedFile));
} catch (err) {
  console.log("⚠️ Error cargando archivos JSON, se inicializan vacíos:", err);
}

export default async function handler(req, res) {
  const TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    console.log("⚠️ BOT_TOKEN o CHAT_ID no definidos. No se enviarán mensajes.");
    return res.status(500).json({ ok: false, error: "BOT_TOKEN o CHAT_ID no definidos" });
  }

  try {
    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();

    for (const partido of data.events || []) {
      const home = partido.homeTeam.name;
      const away = partido.awayTeam.name;
      const matchId = partido.id;

      // Filtrar solo equipos vigilados
      if (!EQUIPOS.includes(home) && !EQUIPOS.includes(away)) continue;

      // 🟢 Inicio partido
      const startKey = `start-${matchId}`;
      if (partido.status.type === "inprogress" && !PARTIDOS_ALERTADOS.includes(startKey)) {
        const msg = `🟢 PARTIDO INICIADO\n${home} vs ${away}`;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
        });
        PARTIDOS_ALERTADOS.push(startKey);
      }

      // 🔴 Final partido
      const endKey = `end-${matchId}`;
      if (partido.status.type === "finished" && !PARTIDOS_ALERTADOS.includes(endKey)) {
        const msg = `🔴 PARTIDO FINALIZADO\n${home} ${partido.homeScore.current} - ${partido.awayScore.current} ${away}`;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
        });
        PARTIDOS_ALERTADOS.push(endKey);
      }

      // ⚽ Goles
      try {
        const incidentsResp = await fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`);
        const incidents = await incidentsResp.json();

        for (const inc of incidents.incidents || []) {
          if (inc.incidentType !== "goal") continue;

          const key = `${matchId}-${inc.time}-${inc.player?.name || "Desconocido"}`;
          if (GOLES_ENVIADOS.includes(key)) continue;

          GOLES_ENVIADOS.push(key);

          const isPenalty = inc.details?.type === "penalty" ? " (P)" : "";
          const msg = `⚽ GOL (${inc.time}')${isPenalty}\n${home} ${partido.homeScore.current} - ${partido.awayScore.current} ${away}\n⚽ ${inc.player?.name || "Desconocido"}`;

          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
          });
        }
      } catch (err) {
        console.log(`⚠️ Error obteniendo goles del partido ${matchId}:`, err);
      }
    }

    // Guardar JSON
    fs.writeFileSync(sentGoalsFile, JSON.stringify(GOLES_ENVIADOS, null, 2));
    fs.writeFileSync(alertedFile, JSON.stringify(PARTIDOS_ALERTADOS, null, 2));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("⚠️ Error en /api/checkGoals:", err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
}
