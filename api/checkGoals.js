// api/checkGoals.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Archivos JSON
const teamsFile = path.join(process.cwd(), "data", "teams.json");
const sentGoalsFile = path.join(process.cwd(), "data/sentGoals.json");
const alertedFile = path.join(process.cwd(), "data/alertedMatches.json");

// Cargar datos
let EQUIPOS = JSON.parse(fs.readFileSync(teamsFile));
let GOLES_ENVIADOS = JSON.parse(fs.readFileSync(sentGoalsFile));
let PARTIDOS_ALERTADOS = JSON.parse(fs.readFileSync(alertedFile));

export default async function handler(req, res) {
  const TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  try {
    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();

    for (const partido of data.events) {
      const home = partido.homeTeam.name;
      const away = partido.awayTeam.name;
      const matchId = partido.id;

      // Filtrar solo los equipos que nos interesan
      if (!EQUIPOS.includes(home) && !EQUIPOS.includes(away)) continue;

      // Alertas de inicio
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

      // Alertas de final
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

      // Revisar goles
      const incidentsResp = await fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`);
      const incidents = await incidentsResp.json();

      for (const inc of incidents.incidents || []) {
        if (inc.incidentType === "goal") {
          const key = `${matchId}-${inc.time}-${inc.player.name}`;
          if (GOLES_ENVIADOS.includes(key)) continue;

          GOLES_ENVIADOS.push(key);

          const msg = `⚽ GOL\n${home} ${partido.homeScore.current} - ${partido.awayScore.current} ${away}\n⚽ ${inc.player.name} ${inc.time}'`;

          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
          });
        }
      }
    }

    // Guardar JSON
    fs.writeFileSync(sentGoalsFile, JSON.stringify(GOLES_ENVIADOS));
    fs.writeFileSync(alertedFile, JSON.stringify(PARTIDOS_ALERTADOS));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
}
