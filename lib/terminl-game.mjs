import { hash, validateReplay, replayRun, TARGET_SCORE, END_TICK } from "./rug-run.mjs";
export { hash } from "./rug-run.mjs";
export const STORAGE_KEY = "terminl-os:v2";
export const BOTS = [
  { id: "max", name: "Margin Call Max", portrait: "margin-call-max", style: "ALL GAS. NO BRAKES.", quote: "Size was the problem. Not direction.", difficulty: "CHAOTIC" },
  { id: "chloe", name: "Cold Storage Chloe", portrait: "cold-storage-chloe", style: "SUSPICIOUSLY SENSIBLE.", quote: "Have you considered doing less?", difficulty: "TACTICAL" },
  { id: "brian", name: "Buy-High Brian", portrait: "buy-high-brian", style: "THE TOP HAS A FACE.", quote: "This feels like a healthy entry.", difficulty: "UNPREDICTABLE" },
];
export const THEMES = [
  { id: "phosphor", name: "Factory phosphor", color: "#7dff5c", price: 0, description: "Straight out of the box. Slightly radioactive." },
  { id: "amber", name: "After-hours amber", color: "#ffc47b", price: 120, description: "For trades made after everyone went home." },
  { id: "pink", name: "Bubblegum crash", color: "#ffabd1", price: 220, description: "Financial ruin has never looked this cute." },
  { id: "ice", name: "Cold storage", color: "#96e8ed", price: 350, description: "Emotionally unavailable. Visually immaculate." },
];

export const TROPHIES = [
  { id: "boot", symbol: "✦", name: "Welcome to the trenches", description: "Finish your first run." },
  { id: "profit", symbol: "↗", name: "Bag secured", description: "Bank at least 1,000 points." },
  { id: "double", symbol: "×2", name: "Highly unsustainable", description: "Bank at least 2,500 points." },
  { id: "cash", symbol: "☀", name: "Exit strategy", description: "Cash out early with at least 500 points." },
  { id: "bot", symbol: "⚑", name: "Better than a degen", description: "Beat a practice opponent." },
  { id: "friend", symbol: "⚔", name: "Friendly fire", description: "Beat a friend's challenge." },
  { id: "five", symbol: "Ⅴ", name: "One more. Last one.", description: "Finish five runs." },
  { id: "rekt", symbol: "↓", name: "Exit liquidity", description: "Get completely rugged. It happens." },
];
export function dailySeed(date = new Date()) { return "daily-" + date.toISOString().slice(0, 10); }
export function validateChallenge(data) {
  if (!data || data.v !== 2 || typeof data.name !== "string" || !/^[a-zA-Z0-9 _-]{1,20}$/.test(data.name)
    || typeof data.coin !== "string" || !/^[A-Z0-9]{2,8}$/.test(data.coin)) return null;
  const record = validateReplay(data);
  if (!record) return null;
  try { replayRun(record); } catch { return null; }
  return { v: 2, name: data.name, coin: data.coin, ...record };
}
export function encodeChallenge(data) {
  const valid = validateChallenge(data);
  if (!valid) throw new Error("Invalid challenge");
  // Compact movement tuples keep a typical 45-second challenge link under 2 KB.
  const packed = [2, valid.name, valid.coin, valid.seed, valid.endTick, valid.moves.map(m => [m.tick,m.lane])];
  return btoa(JSON.stringify(packed)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function decodeChallenge(code) {
  try {
    if (typeof code !== "string" || code.length > 18000 || !/^[\w-]+$/.test(code)) return null;
    const p = JSON.parse(atob(code.replaceAll("-", "+").replaceAll("_", "/")));
    if (!Array.isArray(p) || p.length !== 6 || !Array.isArray(p[5]) || p[5].some(m => !Array.isArray(m) || m.length !== 2)) return null;
    return validateChallenge({ v:p[0], name:p[1], coin:p[2], seed:p[3], endTick:p[4], moves:p[5].map(([tick,lane]) => ({tick,lane})) });
  } catch { return null; }
}
export function freshProfile() {
  return { version: 2, name: "ANON", credits: 0, xp: 0, games: 0, wins: 0, best: 0,
    theme: "phosphor", owned: ["phosphor"], trophies: [], history: [], dailyClaims: [], machine: 0, sound: false };
}
export function readProfile(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || p.version !== 2) return freshProfile();
    const base = freshProfile();
    for (const key of ["credits", "xp", "games", "wins", "best", "machine"]) {
      if (Number.isSafeInteger(p[key]) && p[key] >= 0) base[key] = Math.min(p[key], 100000000);
    }
    base.name = typeof p.name === "string" && /^[a-zA-Z0-9 _-]{1,20}$/.test(p.name) ? p.name : "ANON";
    base.owned = [...new Set(["phosphor", ...(Array.isArray(p.owned) ? p.owned.filter(id => THEMES.some(t => t.id === id)) : [])])];
    base.theme = base.owned.includes(p.theme) ? p.theme : "phosphor";
    base.trophies = Array.isArray(p.trophies) ? p.trophies.filter(id => TROPHIES.some(t => t.id === id)) : [];
    base.dailyClaims = Array.isArray(p.dailyClaims) ? p.dailyClaims.filter(d => typeof d === "string" && /^daily-\d{4}-\d{2}-\d{2}$/.test(d)).slice(-60) : [];
    base.history = Array.isArray(p.history) ? p.history.filter(r => r && typeof r.id === "string" && Number.isSafeInteger(r.score) && r.score >= 0 && Number.isSafeInteger(r.reward) && r.reward >= 0 && typeof r.win === "boolean" && ["daily", "practice", "challenge"].includes(r.mode) && typeof r.title === "string" && typeof r.date === "string" && Number.isFinite(Date.parse(r.date))).slice(0, 30) : [];
    base.sound = p.sound === true;
    return base;
  } catch { return freshProfile(); }
}

export function resultFor(run) {
  const state = replayRun(run.record);
  const score = state.lastBankValue;
  const rival = run.rivalRecord ? replayRun(run.rivalRecord).lastBankValue : null;
  const win = rival === null ? score >= TARGET_SCORE : score > rival;
  const tie = rival !== null && score === rival;
  const title = state.dead ? "You were the exit liquidity." : tie ? "Mutually assured mediocrity." : rival !== null && win ? "Your opponent is coping." : score >= 2500 ? "Unreasonably solvent." : score >= TARGET_SCORE ? "Bag secured. Ego inflated." : score > 0 ? "Lived to degen another day." : "All vibes. No bags.";
  return { score, rival, win, tie, title, dead: state.dead, coins: state.coins, bestCombo: state.bestCombo, duration: state.tick / 20, banked: !state.dead && state.tick < END_TICK, prices: state.prices };
}
export function awardRun(profile, run, date = new Date()) {
  const result = resultFor(run);
  if (profile.history.some(r => r.id === run.id)) return { profile, reward: 0, unlocked: [], dailyBonus: 0, ...result };
  const conditions = { boot: true, profit: result.score >= 1000, double: result.score >= 2500,
    cash: result.banked && result.score >= 500, bot: run.mode === "practice" && result.win,
    friend: run.mode === "challenge" && !!run.rivalRecord && result.win, five: profile.games + 1 >= 5, rekt: result.dead };
  const unlocked = TROPHIES.filter(t => conditions[t.id] && !profile.trophies.includes(t.id)).map(t => t.id);
  const dailyBonus = run.mode === "daily" && run.seed === dailySeed(date) && !profile.dailyClaims.includes(run.seed) ? 100 : 0;
  const reward = 60 + (result.win ? 80 : 0) + unlocked.length * 50 + dailyBonus;
  const entry = { id: run.id, score: result.score, mode: run.mode, title: result.title, win: result.win, date: date.toISOString(), reward };
  return { ...result, reward, unlocked, dailyBonus, profile: { ...profile,
    credits: profile.credits + reward, xp: profile.xp + 100 + (result.win ? 50 : 0),
    games: profile.games + 1, wins: profile.wins + Number(result.win), best: Math.max(profile.best, result.score),
    trophies: [...profile.trophies, ...unlocked], history: [entry, ...profile.history].slice(0, 30),
    dailyClaims: dailyBonus ? [...profile.dailyClaims, run.seed].slice(-60) : profile.dailyClaims } };
}
export function purchaseTheme(profile, id) {
  const theme = THEMES.find(t => t.id === id);
  if (!theme) return profile;
  if (profile.owned.includes(id)) return { ...profile, theme: id };
  if (profile.credits < theme.price) return profile;
  return { ...profile, credits: profile.credits - theme.price, theme: id, owned: [...profile.owned, id] };
}
