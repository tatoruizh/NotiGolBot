// api/command.js
export default async function commandHandler(req, res) {
  const message = req.body.message;

  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text;

  // ejemplo simple
  if (text === "/list") {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=Lista de equipos: Real Madrid, Barcelona...`);
  }

  res.sendStatus(200);
}  } else if (text === "/list") {
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
