import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getMatchesByDate } from "../goalWatcher.js";

const teamsFile = path.join(process.cwd(), "data", "teams.json");

export default async function handler(req, res) {

  try {

    // ===== Leer body correctamente =====
    let body = req.body;

    if (!body) {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
      }
      body = JSON.parse(raw);
    }

    console.log("⚡ Update recibido:", body);

    if (!body || !body.message) {
      res.writeHead(200);
      res.end("ok");
      return;
    }

    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();

    if (!text) {
      res.writeHead(200);
      res.end("ok");
      return;
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.log("❌ BOT_TOKEN o CHAT_ID no definidos");
      res.writeHead(200);
      res.end("ok");
      return;
    }

    // ===== función enviar mensaje =====
    async function sendMessage(chatId, msg) {

      try {

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: msg
          })
        });

      } catch (err) {

        console.log("Error enviando mensaje:", err);

      }
    }

    // ===== leer teams.json =====
    let teams = [];

    try {

      if (fs.existsSync(teamsFile)) {
        teams = JSON.parse(fs.readFileSync(teamsFile));
      } else {
        fs.writeFileSync(teamsFile, JSON.stringify([]));
      }

    } catch (err) {

      console.log("Error leyendo teams.json:", err);
      teams = [];

    }

    // ===== COMANDOS =====

    // LIST
    if (text === "/list") {

      const msg =
        "📋 Equipos vigilados:\n\n" +
        (teams.length ? teams.join("\n") : "No hay equipos aún");

      await sendMessage(chatId, msg);

    }

    // ADD
    else if (text.startsWith("/add ")) {

      const teamToAdd = text.replace("/add ", "").trim();

      if (!teams.includes(teamToAdd)) {

        teams.push(teamToAdd);

        fs.writeFileSync(
          teamsFile,
          JSON.stringify(teams, null, 2)
        );

        await sendMessage(chatId, `✅ ${teamToAdd} añadido`);

      } else {

        await sendMessage(chatId, `⚠️ ${teamToAdd} ya estaba en la lista`);

      }

    }

    // REMOVE
    else if (text.startsWith("/remove ")) {

      const teamToRemove = text.replace("/remove ", "").trim();

      teams = teams.filter(t => t !== teamToRemove);

      fs.writeFileSync(
        teamsFile,
        JSON.stringify(teams, null, 2)
      );

      await sendMessage(chatId, `🗑️ ${teamToRemove} eliminado`);

    }

    // TODAY
    else if (text === "/today") {

      const today = new Date().toISOString().split("T")[0];

      const matches = await getMatchesByDate(today);

      await sendMessage(
        chatId,
        "⚽ Partidos de hoy:\n\n" + matches.join("\n")
      );

    }

    // TOMORROW
    else if (text === "/tomorrow") {

      const tomorrowDate = new Date();

      tomorrowDate.setDate(tomorrowDate.getDate() + 1);

      const tomorrow = tomorrowDate.toISOString().split("T")[0];

      const matches = await getMatchesByDate(tomorrow);

      await sendMessage(
        chatId,
        "⚽ Partidos de mañana:\n\n" + matches.join("\n")
      );

    }

    // ===== respuesta obligatoria =====
    res.writeHead(200);
    res.end("ok");

  } catch (err) {

    console.log("⚠️ Error en command handler:", err);

    res.writeHead(200);
    res.end("ok");

  }
}
