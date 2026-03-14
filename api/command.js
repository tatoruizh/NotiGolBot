// api/command.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const teamsFile = path.join("data", "teams.json");
const sentFile = path.join("data", "sentGoals.json");

export default async function commandHandler(req, res) {
  const message = req.body.message;
  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim();

  // lee equipos
  let teams = JSON.parse(fs.readFileSync(teamsFile, "utf-8"));
  
  if (text.startsWith("/list")) {
    await sendMessage(chatId, "Equipos vigilados: " + teams.join(", "));
  } else if (text.startsWith("/add ")) {
    const team = text.replace("/add ", "").trim();
    if (!teams.includes(team)) {
      teams.push(team);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `Equipo agregado: ${team}`);
    } else {
      await sendMessage(chatId, `El equipo ya está agregado: ${team}`);
    }
  } else if (text.startsWith("/remove ")) {
    const team = text.replace("/remove ", "").trim();
    if (teams.includes(team)) {
      teams = teams.filter(t => t !== team);
      fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 2));
      await sendMessage(chatId, `Equipo eliminado: ${team}`);
    } else {
      await sendMessage(chatId, `El equipo no estaba en la lista: ${team}`);
    }
  }

  res.sendStatus(200);
}

// Función para enviar mensaje a Telegram
async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`);
}

else if (text === "/today") {
  await sendMessage(chatId, "⚽ Partidos de hoy:\n- Revisa SofaScore o implementa API diaria para tus equipos");
} else if (text === "/tomorrow") {
  await sendMessage(chatId, "⚽ Partidos de mañana:\n- Revisa SofaScore o implementa API diaria para tus equipos");
}
