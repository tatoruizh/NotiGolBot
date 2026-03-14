import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { teams, sentEvents, alertedMatches, saveJSON } from "../goalWatcher.js";

const dataDir = path.join(process.cwd(), "data");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");
const alertedFile = path.join(dataDir, "alertedMatches.json");

export default async function handler(req, res) {
  try {
    const TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
    const TSDB_KEY = process.env.THESPORTSDB_KEY;

    if (!TOKEN || !CHAT_ID || !TSDB_KEY) return res.sendStatus(500);

    // Recorremos cada equipo vigilado para ver sus últimos partidos
    for (const team of teams) {
      const resp = await fetch(`https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventslast.php?t=${encodeURIComponent(team)}`);
      const data = await resp.json();
      const events = data.results || [];

      for (const match of events) {
        const home = match.strHomeTeam;
        const away = match.strAwayTeam;
        const matchId = match.idEvent;

        if (!teams.includes(home) && !teams.includes(away)) continue;

        // 🟢 PARTIDO INICIADO
        const startKey = `start-${matchId}`;
        if (!alertedMatches.includes(startKey)) {
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: `🟢 PARTIDO INICIADO\n${home} vs ${away}` })
          });
          alertedMatches.push(startKey);
        }

        // 🔴 PARTIDO FINALIZADO
        const endKey = `end-${matchId}`;
        if (!alertedMatches.includes(endKey) && match.intHomeScore !== null) {
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text: `🔴 PARTIDO FINALIZADO\n${home} ${match.intHomeScore} - ${match.intAwayScore} ${away}`
            })
          });
          alertedMatches.push(endKey);
        }

        // ⚽ GOLES (simulado con score final)
        const goalKey = `goal_${matchId}_${match.intHomeScore}_${match.intAwayScore}`;
        if (!sentEvents.includes(goalKey) && match.intHomeScore !== null) {
          sentEvents.push(goalKey);
          const msg = `⚽ Resultado actualizado\n${home} ${match.intHomeScore} - ${match.intAwayScore} ${away}`;
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
          });
        }
      }
    }

    // Guardar JSON
    saveJSON();
    res.status(200).json({ ok: true });

  } catch (err) {
    console.log("⚠️ Error checkGoals TheSportsDB:", err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
}
