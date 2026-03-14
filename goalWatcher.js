import fetch from "node-fetch";
import fs from "fs";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const teams = JSON.parse(fs.readFileSync("./data/teams.json"));
let sentEvents = JSON.parse(fs.readFileSync("./data/sentGoals.json"));

async function send(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });
}

async function checkMatches() {

  try {

    const res = await fetch(
      "https://api.sofascore.com/api/v1/sport/football/events/live"
    );

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
      const goalKey = `goal_${match.id}_${homeScore}_${awayScore}`;

      // INICIO PARTIDO
      if (!sentEvents.includes(matchKey) && minute <= 1) {

        sentEvents.push(matchKey);

        await send(
`🟢 INICIO DE PARTIDO
🏆 ${tournament}

${home} vs ${away}`
        );

      }

      // GOL
      if (!sentEvents.includes(goalKey)) {

        sentEvents.push(goalKey);

        await send(
`⚽ GOOOOOL (${minute}')
🏆 ${tournament}

${home} ${homeScore} - ${awayScore} ${away}`
        );

      }

      // FINAL PARTIDO
      if (match.status?.type === "finished") {

        const finalKey = `final_${match.id}`;

        if (!sentEvents.includes(finalKey)) {

          sentEvents.push(finalKey);

          await send(
`🔴 FINAL DEL PARTIDO
🏆 ${tournament}

${home} ${homeScore} - ${awayScore} ${away}`
          );

        }

      }

    }

    fs.writeFileSync(
      "./data/sentGoals.json",
      JSON.stringify(sentEvents, null, 2)
    );

  } catch (err) {

    console.log("Error SofaScore:", err);

  }

}

setInterval(checkMatches, 45000);
