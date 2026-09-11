// A shareable image generated locally; no wallet, upload, or external service.
export async function saveReceipt(run, profile, machine) {
  const canvas = document.createElement("canvas");
  canvas.width = 900; canvas.height = 1260;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#19251d"; ctx.fillRect(0, 0, 900, 1260);
  ctx.fillStyle = "#f4f1e7"; ctx.fillRect(55, 50, 790, 1160);
  ctx.fillStyle = "#1d2921";
  ctx.font = "bold 32px monospace"; ctx.fillText("TERMINL OS", 95, 115);
  ctx.font = "16px monospace"; ctx.fillText("RUG RUNNER / OFFICIAL DAMAGE REPORT", 95, 150);
  const art = new window.Image();
  await new Promise((resolve, reject) => {
    art.onload = resolve; art.onerror = reject; art.src = `/art/${machine.slug}.webp`;
  });
  ctx.drawImage(art, 290, 190, 320, 320);
  ctx.textAlign = "center"; ctx.font = "bold 26px monospace";
  // Wrap the authored outcome so long lines fit the exported image.
  const words = run.summary.title.split(" ");
  let line = "", y = 560;
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > 650) { ctx.fillText(line, 450, y); y += 34; line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  ctx.fillText(line, 450, y);
  ctx.font = "18px monospace"; ctx.fillText(`OPERATOR: ${profile.name || "ANON"}`, 450, 650);
  ctx.font = "bold 88px monospace"; ctx.fillText(run.summary.score.toLocaleString("en-US"), 450, 750);
  ctx.font = "18px monospace"; ctx.fillText(`POINTS BANKED / $${run.coin}`, 450, 795);
  if (run.summary.rival !== null) {
    ctx.font = "15px monospace";
    ctx.fillText(`VS. ${run.rivalName}: ${run.summary.rival.toLocaleString("en-US")} / ${run.summary.tie ? "DRAW" : run.summary.win ? "YOU WIN" : "RIVAL WINS"}`, 450, 825);
  }
  ctx.textAlign = "left"; ctx.setLineDash([5, 7]); ctx.strokeStyle = "#8a9182";
  ctx.beginPath(); ctx.moveTo(95, 845); ctx.lineTo(805, 845); ctx.stroke();
  ctx.font = "19px monospace";
  const stats = [
    `TIME IN THE TRENCHES    ${run.summary.duration.toFixed(1)}s`,
    `CANDLES COLLECTED       ${run.summary.coins}`,
    `BEST PICKUP STREAK      ${run.summary.bestCombo}`,
    `EXIT STATUS            ${run.summary.dead ? "COMPLETELY RUGGED" : run.summary.banked ? "CASHED OUT EARLY" : "SURVIVED"}`,
    "BALANCE TYPE           ENTIRELY FICTIONAL",
  ];
  stats.forEach((line, i) => ctx.fillText(line, 110, 890 + i * 35));
  ctx.textAlign = "center"; ctx.font = "bold 23px monospace";
  ctx.fillText(`+${run.summary.reward} CR.  ZERO FINANCIAL ADVICE.`, 450, 1110);
  ctx.font = "15px monospace"; ctx.fillText("PLAY. GET REKT. KEEP THE RECEIPT. / TERMINL OS", 450, 1155);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export receipt");
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `terminl-receipt-${run.summary.score}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
