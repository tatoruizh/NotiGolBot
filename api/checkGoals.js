import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { sentEvents, alertedMatches, saveJSON, teams } from "../goalWatcher.js";

const dataDir = path.join(process.cwd(), "data");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");
const alertedFile = path.join(dataDir, "alertedMatches.json");

export default async function handler(req, res) {
  try {
    const TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!TOKEN || !CHAT_ID) return res.sendStatus(500);

    const resp = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live");
    const data = await resp.json();
    const events = data.events || [];

    for (const match of events) {
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;
      const matchId = match.id;

      if (!teams.includes(home) && !teams.includes(away)) continue;

      const startKey = `start-${matchId}`;
      if (match.status.type === "inprogress" && !alertedMatches.includes(startKey)) {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHAT_ID, text: `🟢 PARTIDO INICIADO\n${home} vs ${away}` })
        });
        alertedMatches.push(startKey);
      }

      const endKey = `end-${matchId}`;
      if (match.status.type === "finished" && !alertedMatches.includes(endKey)) {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHAT_ID, text: `🔴 PARTIDO FINALIZADO\n${home} ${match.homeScore.current} - ${match.awayScore.current} ${away}` })
        });
        alertedMatches.push(endKey);
      }

      // Goles
      const incidentsResp = await fetch(`https://api.sofascore.com/api/v1/event/${matchId}/incidents`);
      const incidentsData = await incidentsResp.json();
      const incidents = incidentsData.incidents || [];

      for (const inc of incidents) {
        if (inc.incidentType === "goal") {
          const key = `${matchId}-${inc.time}-${inc.player.name}`;
          if (sentEvents.includes(key)) continue;
          sentEvents.push(key);

          const isPenalty = inc.details?.type === "penalty" ? " (P)" : "";
          const msg = `⚽ GOL (${inc.time}')${isPenalty}\n${home} ${match.homeScore.current} - ${match.awayScore.current} ${away}\n⚽ ${inc.player.name}`;
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
          });
        }
      }
    }

    saveJSON();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.log("⚠️ Error checkGoals:", err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
}
