import fs from "fs";
import { getMatchesByDate } from "../goalWatcher.js";

const teamsFile = "./data/teams.json";

export default async function handler(req, res) {
  const body = req.body;
  if (!body || !body.message) return res.sendStatus(200);

  const chatId = body.message.chat.id;
  const text = body.message.text?.trim();
  if (!text) return res.sendStatus(200);

  async function sendMessage(chatId, text) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  }

  // LEER teams.json
  let teams = JSON.parse(fs.readFileSync(teamsFile));

  if (text === "/list") {
    await sendMessage(chatId, "Equipos vigilados:\n" + teams.join("\n"));
  } else if (text.startsWith("/add ")) {
    const teamToAdd = text.replace("/add ", "").trim();
    if (!teams.includes(teamToAdd)) {
      teams.push(teamToAdd);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `${teamToAdd} añadido a la lista`);
    } else {
      await sendMessage(chatId, `${teamToAdd} ya estaba en la lista`);
    }
  } else if (text.startsWith("/remove ")) {
    const teamToRemove = text.replace("/remove ", "").trim();
    teams = teams.filter(t => t !== teamToRemove);
    fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
    await sendMessage(chatId, `${teamToRemove} eliminado de la lista`);
  } else if (text === "/today") {
    const today = new Date().toISOString().split("T")[0];
    const matches = await getMatchesByDate(today);
    await sendMessage(chatId, "⚽ Partidos de hoy:\n" + matches.join("\n"));
  } else if (text === "/tomorrow") {
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split("T")[0];
    const matches = await getMatchesByDate(tomorrow);
    await sendMessage(chatId, "⚽ Partidos de mañana:\n" + matches.join("\n"));
  }

  res.sendStatus(200);
}
