import fetch from "node-fetch";
import fs from "fs";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const teams = JSON.parse(fs.readFileSync("./data/teams.json"));
let sentEvents = JSON.parse(fs.readFileSync("./data/sentGoals.json"));

// Función para enviar mensaje a Telegram
async function send(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });
}

// Función para revisar partidos en directo
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

      // INICIO PARTIDO
      if (!sentEvents.includes(matchKey) && minute <= 1) {
        sentEvents.push(matchKey);
        await send(`🟢 INICIO DE PARTIDO\n🏆 ${tournament}\n\n${home} vs ${away}`);
      }

      // GOLES
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

      // FINAL PARTIDO
      if (match.status?.type === "finished" && !sentEvents.includes(finalKey)) {
        sentEvents.push(finalKey);
        await send(`🔴 FINAL DEL PARTIDO\n🏆 ${tournament}\n\n${home} ${homeScore} - ${awayScore} ${away}`);
      }
    }

    fs.writeFileSync("./data/sentGoals.json", JSON.stringify(sentEvents, null, 2));

  } catch (err) {
    console.log("Error SofaScore:", err);
  }
}

// Llamar automáticamente cada 45 segundos
setInterval(checkMatches, 45000);

// Función para obtener partidos por fecha (para /today y /tomorrow)
export async function getMatchesByDate(date) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/events/${date}`);
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => teams.includes(m.homeTeam.name) || teams.includes(m.awayTeam.name))
      .map(m => `${m.homeTeam.name} vs ${m.awayTeam.name} — ${m.tournament.name} — ${m.time?.startingAt || "Hora desconocida"}`);

    if (matches.length === 0) return ["No hay partidos para tus equipos"];
    return matches;

  } catch (err) {
    console.log("Error al obtener partidos por fecha:", err);
    return ["Error al consultar SofaScore"];
  }
}
