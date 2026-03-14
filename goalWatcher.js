import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const teamsFile = path.join(dataDir, "teams.json");
const sentGoalsFile = path.join(dataDir, "sentGoals.json");
const alertedFile = path.join(dataDir, "alertedMatches.json");

// Inicializar JSON vacíos si no existen
if (!fs.existsSync(teamsFile)) fs.writeFileSync(teamsFile, JSON.stringify([]));
if (!fs.existsSync(sentGoalsFile)) fs.writeFileSync(sentGoalsFile, JSON.stringify([]));
if (!fs.existsSync(alertedFile)) fs.writeFileSync(alertedFile, JSON.stringify([]));

export let sentEvents = JSON.parse(fs.readFileSync(sentGoalsFile));
export let alertedMatches = JSON.parse(fs.readFileSync(alertedFile));
export const teams = JSON.parse(fs.readFileSync(teamsFile));

export async function saveJSON() {
  fs.writeFileSync(sentGoalsFile, JSON.stringify(sentEvents, null, 2));
  fs.writeFileSync(alertedFile, JSON.stringify(alertedMatches, null, 2));
}

// Función para obtener partidos por fecha
export async function getMatchesByDate(dateStr) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled/${dateStr}`);
    const data = await res.json();
    const events = data.events || [];

    const matches = events
      .filter(m => teams.includes(m.homeTeam.name) || teams.includes(m.awayTeam.name))
      .map(m => {
        const localTime = new Date(m.startingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${m.homeTeam.name} vs ${m.awayTeam.name} — ${m.tournament.name} — ${localTime}`;
      });

    return matches.length ? matches : ["No hay partidos para tus equipos"];
  } catch (err) {
    console.log("Error getMatchesByDate:", err);
    return ["Error al consultar SofaScore"];
  }
}
