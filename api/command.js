// api/command.js
import fs from "fs";
import path from "path";

const teamsFile = path.join(process.cwd(), "data/teams.json");

export default async function handler(req, res) {
  const TOKEN = process.env.BOT_TOKEN;

  const { message } = req.body;
  if (!message || !message.text) return res.status(400).send("No message");

  const chatId = message.chat.id;
  const text = message.text.trim();
  let teams = JSON.parse(fs.readFileSync(teamsFile));

  let reply = "";

  if (text.startsWith("/add ")) {
    const equipo = text.slice(5).trim();
    if (!teams.includes(equipo)) {
      teams.push(equipo);
      fs.writeFileSync(teamsFile, JSON.stringify(teams));
      reply = `✅ Equipo añadido: ${equipo}`;
    } else {
      reply = `⚠️ El equipo ya estaba en la lista`;
    }
  } else if (text.startsWith("/remove ")) {
    const equipo = text.slice(8).trim();
    if (teams.includes(equipo)) {
      teams = teams.filter(e => e !== equipo);
      fs.writeFileSync(teamsFile, JSON.stringify(teams));
      reply = `❌ Equipo eliminado: ${equipo}`;
    } else {
      reply = `⚠️ El equipo no estaba en la lista`;
    }
  } else if (text === "/list") {
    reply = `📋 Equipos activos:\n${teams.join("\n")}`;
  } else {
    reply = "⚠️ Comando no reconocido. Usa /add, /remove o /list";
  }

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply })
  });

  res.status(200).json({ ok: true });
}
