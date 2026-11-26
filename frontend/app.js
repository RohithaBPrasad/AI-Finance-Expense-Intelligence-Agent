const API = "";

// ---------- tab switching ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "dashboard") loadDashboard();
    if (btn.dataset.tab === "transactions") loadTransactions();
    if (btn.dataset.tab === "budgets") loadBudgets();
  });
});

async function jfetch(url, options = {}) {
  const res = await fetch(API + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ---------- ollama status ----------
async function checkOllama() {
  const el = document.getElementById("ollamaStatus");
  try {
    const r = await jfetch("/api/ollama/status");
    if (r.available) {
      el.textContent = "● local LLM connected";
      el.className = "ollama-status online";
    } else {
      el.textContent = "● Ollama not reachable";
      el.className = "ollama-status offline";
    }
  } catch {
    el.textContent = "● backend unreachable";
    el.className = "ollama-status offline";
  }
}

// ---------- dashboard ----------
let categoryChart, trendChart;

async function loadDashboard() {
  const summary = await jfetch("/api/analytics/summary");
  const cardsEl = document.getElementById("summaryCards");
  cardsEl.innerHTML = `
    <div class="card"><div class="label">Total Spend</div><div class="value">$${summary.total_spend.toLocaleString()}</div></div>
    <div class="card"><div class="label">Transactions</div><div class="value">${summary.total_transactions}</div></div>
    <div class="card"><div class="label">Anomalies</div><div class="value">${summary.anomaly_count}</div></div>
    <div class="card"><div class="label">Categories</div><div class="value">${summary.by_category.length}</div></div>
  `;

  const catCtx = document.getElementById("categoryChart");
  const cats = summary.by_category;
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(catCtx, {
    type: "pie",
    data: {
      labels: cats.map(c => c.category),
      datasets: [{ data: cats.map(c => c.total),
        backgroundColor: ["#6c8cff","#38d9a9","#ffb84d","#ff6b6b","#a78bfa","#4dd0e1","#f783ac","#94d82d"] }]
    },
    options: { plugins: { legend: { labels: { color: "#e7ebf5" } } } }
  });

  const trendCtx = document.getElementById("trendChart");
  const months = summary.by_month;
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: "line",
    data: {
      labels: months.map(m => m.month),
      datasets: [{ label: "Spend", data: months.map(m => m.total),
        borderColor: "#6c8cff", backgroundColor: "rgba(108,140,255,0.15)", fill: true, tension: 0.3 }]
    },
    options: {
      plugins: { legend: { labels: { color: "#e7ebf5" } } },
      scales: { x: { ticks: { color: "#8a94ab" } }, y: { ticks: { color: "#8a94ab" } } }
    }
  });

  const anomalies = await jfetch("/api/anomalies");
  const listEl = document.getElementById("anomalyList");
  listEl.innerHTML = anomalies.length
    ? anomalies.map(a => `
        <div class="list-item">
          <span>${a.date?.slice(0,10) || ""} — <strong>${a.vendor}</strong> ($${a.amount.toFixed(2)}, ${a.category})</span>
          <span class="muted">${a.anomaly_reason || ""}</span>
        </div>`).join("")
    : `<p class="muted">No anomalies flagged yet. Run detection from the Transactions tab once you have data.</p>`;
}

// ---------- upload ----------
document.getElementById("docUploadBtn").addEventListener("click", async () => {
  const input = document.getElementById("docFileInput");
  const resultEl = document.getElementById("docUploadResult");
  if (!input.files.length) { resultEl.textContent = "Choose a file first."; return; }
  const fd = new FormData();
  fd.append("file", input.files[0]);
  resultEl.textContent = "Processing (OCR)…";
  try {
    const r = await jfetch("/api/upload/document", { method: "POST", body: fd });
    resultEl.textContent = `Added: ${r.vendor} — $${r.amount.toFixed(2)} (${r.category})`;
  } catch (e) {
    resultEl.textContent = "Error: " + e.message;
  }
});

document.getElementById("csvUploadBtn").addEventListener("click", async () => {
  const input = document.getElementById("csvFileInput");
  const resultEl = document.getElementById("csvUploadResult");
  if (!input.files.length) { resultEl.textContent = "Choose a CSV file first."; return; }
  const fd = new FormData();
  fd.append("file", input.files[0]);
  resultEl.textContent = "Importing…";
  try {
    const r = await jfetch("/api/upload/csv", { method: "POST", body: fd });
    resultEl.textContent = `Imported ${r.inserted_count} transactions.`;
  } catch (e) {
    resultEl.textContent = "Error: " + e.message;
  }
});

document.getElementById("manAddBtn").addEventListener("click", async () => {
  const vendor = document.getElementById("manVendor").value;
  const amount = parseFloat(document.getElementById("manAmount").value);
  const description = document.getElementById("manDesc").value;
  const date = document.getElementById("manDate").value;
  const resultEl = document.getElementById("manResult");
  if (!vendor || !amount) { resultEl.textContent = "Vendor and amount are required."; return; }
  try {
    const r = await jfetch("/api/transactions/manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor, amount, description, date: date || null })
    });
    resultEl.textContent = `Added: ${r.vendor} — $${r.amount.toFixed(2)} (${r.category})`;
  } catch (e) {
    resultEl.textContent = "Error: " + e.message;
  }
});

// ---------- transactions ----------
async function loadTransactions() {
  const anomalyOnly = document.getElementById("anomalyOnlyToggle").checked;
  const txns = await jfetch(`/api/transactions${anomalyOnly ? "?anomaly_only=true" : ""}`);
  const body = document.getElementById("txnTableBody");
  body.innerHTML = txns.map(t => `
    <tr class="${t.is_anomaly ? "anomaly-row" : ""}">
      <td>${t.date?.slice(0,10) || ""}</td>
      <td>${t.vendor || ""}</td>
      <td>${t.category}</td>
      <td class="amount">$${t.amount.toFixed(2)}</td>
      <td>${t.source}</td>
      <td>${t.is_anomaly ? "⚠ " + (t.anomaly_reason || "") : "—"}</td>
      <td><button class="secondary" onclick="deleteTxn(${t.id})">Delete</button></td>
    </tr>
  `).join("");
}

async function deleteTxn(id) {
  await jfetch(`/api/transactions/${id}`, { method: "DELETE" });
  loadTransactions();
}

document.getElementById("anomalyOnlyToggle").addEventListener("change", loadTransactions);
document.getElementById("refreshTxnsBtn").addEventListener("click", loadTransactions);
document.getElementById("runDetectBtn").addEventListener("click", async () => {
  await jfetch("/api/anomalies/detect", { method: "POST" });
  loadTransactions();
});

// ---------- budgets ----------
document.getElementById("setBudgetBtn").addEventListener("click", async () => {
  const category = document.getElementById("budgetCategory").value;
  const monthly_limit = parseFloat(document.getElementById("budgetLimit").value);
  if (!category || !monthly_limit) return;
  await jfetch("/api/budget", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, monthly_limit })
  });
  document.getElementById("budgetCategory").value = "";
  document.getElementById("budgetLimit").value = "";
  loadBudgets();
});

async function loadBudgets() {
  const rows = await jfetch("/api/budget/analysis");
  const el = document.getElementById("budgetList");
  el.innerHTML = rows.length ? rows.map(r => `
    <div class="list-item">
      <span><strong>${r.category}</strong> — spent $${r.spent.toFixed(2)} ${r.budget != null ? "/ $" + r.budget.toFixed(2) : ""}</span>
      <span class="badge ${r.status}">${r.status.replace(/_/g, " ")}</span>
    </div>
  `).join("") : `<p class="muted">No transactions or budgets yet.</p>`;
}

// ---------- AI assistant ----------
document.getElementById("chatSendBtn").addEventListener("click", sendChat);
document.getElementById("chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

async function sendChat() {
  const input = document.getElementById("chatInput");
  const q = input.value.trim();
  if (!q) return;
  const log = document.getElementById("chatLog");
  log.innerHTML += `<div class="chat-msg user">${q}</div>`;
  input.value = "";
  log.scrollTop = log.scrollHeight;
  const thinkingId = "t" + Date.now();
  log.innerHTML += `<div class="chat-msg agent" id="${thinkingId}">Thinking…</div>`;
  try {
    const r = await jfetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q })
    });
    document.getElementById(thinkingId).innerHTML =
      `${r.answer}<div class="tools">tools used: ${r.tools_used.join(", ")}</div>`;
  } catch (e) {
    document.getElementById(thinkingId).textContent = "Error: " + e.message;
  }
  log.scrollTop = log.scrollHeight;
}

// ---------- report ----------
document.getElementById("genReportBtn").addEventListener("click", async () => {
  const el = document.getElementById("reportOutput");
  el.innerHTML = "Generating report…";
  const md = await (await fetch("/api/report/markdown")).text();
  el.innerHTML = simpleMarkdownToHtml(md);
});

document.getElementById("downloadReportBtn").addEventListener("click", async () => {
  const md = await (await fetch("/api/report/markdown")).text();
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "finance_report.md";
  a.click();
});

function simpleMarkdownToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith("# ")) { html += `<h1>${line.slice(2)}</h1>`; continue; }
    if (line.startsWith("## ")) { html += `<h2>${line.slice(3)}</h2>`; continue; }
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(c => c.trim() !== "");
      if (cells.every(c => /^-+$/.test(c.trim()))) continue;
      if (!inTable) { html += "<table>"; inTable = true; }
      html += "<tr>" + cells.map(c => `<td>${c.trim()}</td>`).join("") + "</tr>";
      continue;
    } else if (inTable) { html += "</table>"; inTable = false; }
    if (line.trim() === "") { html += "<br>"; continue; }
    html += `<p>${line}</p>`;
  }
  if (inTable) html += "</table>";
  return html;
}

// ---------- init ----------
checkOllama();
loadDashboard();
