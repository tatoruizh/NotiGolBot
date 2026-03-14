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

      const key = match.id + "_" + match.homeScore.current + "_" + match.awayScore.current;

      if (sentEvents.includes(key)) continue;

      sentEvents.push(key);

      fs.writeFileSync(
        "./data/sentGoals.json",
        JSON.stringify(sentEvents, null, 2)
      );

      const score = `${match.homeScore.current} - ${match.awayScore.current}`;

      await send(
        `⚽ GOL\n${home} ${score} ${away}`
      );

    }

  } catch (err) {
    console.log("Error leyendo SofaScore:", err);
  }
}

setInterval(checkMatches, 60000);
