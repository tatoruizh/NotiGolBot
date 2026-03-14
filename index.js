import express from "express";
import commandHandler from "./api/command.js";

const app = express();
app.use(express.json());

app.post("/api/command", commandHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Bot running on port", PORT);
});
