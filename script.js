const stocks = [
  { ticker: "NVDA", company: "NVIDIA", sector: "AI", industry: "AI chips", momentum: 96, value: 62, news: 94, risk: 58 },
  { ticker: "MSFT", company: "Microsoft", sector: "AI", industry: "Cloud software", momentum: 88, value: 70, news: 90, risk: 76 },
  { ticker: "XOM", company: "Exxon Mobil", sector: "Energy", industry: "Integrated energy", momentum: 72, value: 84, news: 68, risk: 71 },
  { ticker: "SLB", company: "SLB", sector: "Energy", industry: "Oilfield services", momentum: 69, value: 79, news: 64, risk: 62 },
  { ticker: "LLY", company: "Eli Lilly", sector: "Medicine", industry: "Pharmaceuticals", momentum: 91, value: 54, news: 88, risk: 74 },
  { ticker: "ISRG", company: "Intuitive Surgical", sector: "Medicine", industry: "Medical technology", momentum: 83, value: 63, news: 79, risk: 78 },
  { ticker: "JPM", company: "JPMorgan Chase", sector: "Financials", industry: "Banking", momentum: 80, value: 76, news: 73, risk: 68 },
  { ticker: "COST", company: "Costco", sector: "Consumer", industry: "Retail", momentum: 77, value: 57, news: 71, risk: 82 },
  { ticker: "GE", company: "GE Aerospace", sector: "Industrials", industry: "Aerospace", momentum: 86, value: 66, news: 82, risk: 65 },
  { ticker: "NEE", company: "NextEra Energy", sector: "Utilities", industry: "Clean power", momentum: 64, value: 73, news: 67, risk: 70 }
];

const dailyNews = [
  ["AI", "Chip demand and cloud capex remain the strongest earnings drivers for mega-cap technology."],
  ["Energy", "Crude-sensitive companies show improving cash-flow screens as supply discipline stays in focus."],
  ["Medicine", "Obesity, oncology, and robotic surgery headlines continue to support premium healthcare multiples."],
  ["Risk", "Rate-sensitive groups are best filtered with balance-sheet quality and free-cash-flow stability."],
];

const industries = [
  {
    icon: "⚡",
    title: "Energy",
    text: "Ranks producers, services, and clean-power names by cash flow, commodity sensitivity, and dividend resilience.",
    bullets: ["Best value: XOM", "Momentum watch: SLB", "Risk flag: oil volatility"]
  },
  {
    icon: "🤖",
    title: "AI & Technology",
    text: "Tracks AI infrastructure, cloud platforms, semiconductors, cybersecurity, and automation beneficiaries.",
    bullets: ["Top score: NVDA", "Quality compounder: MSFT", "Key metric: capex growth"]
  },
  {
    icon: "🧬",
    title: "Medicine & Healthcare",
    text: "Compares drug pipelines, device makers, insurers, and services companies with defensive demand.",
    bullets: ["Top momentum: LLY", "Device leader: ISRG", "Key metric: approvals"]
  },
  {
    icon: "🏦",
    title: "Financials",
    text: "Sorts banks, payment networks, asset managers, and insurers by credit risk and earnings quality.",
    bullets: ["Leader: JPM", "Watch: net interest margin", "Risk flag: credit cycle"]
  },
  {
    icon: "🛒",
    title: "Consumer",
    text: "Highlights pricing power, traffic trends, margin expansion, and resilient brands across retail and staples.",
    bullets: ["Defensive pick: COST", "Metric: same-store sales", "Risk flag: weak wallets"]
  },
  {
    icon: "🏭",
    title: "Industrials",
    text: "Scores aerospace, automation, transport, and manufacturing firms using backlog and margin momentum.",
    bullets: ["Momentum: GE", "Metric: backlog", "Risk flag: input costs"]
  }
];

const picks = [
  {
    label: "Stock of the day",
    ticker: "NVDA",
    type: "featured",
    reason: "Best blend of AI news impact, momentum, and institutional demand in the sample screen."
  },
  {
    label: "Stock of the week",
    ticker: "LLY",
    reason: "Healthcare leadership with strong pipeline narrative and resilient medicine demand."
  },
  {
    label: "Stock of the month",
    ticker: "MSFT",
    reason: "Durable cloud growth, AI monetization, and strong risk-adjusted quality profile."
  },
  {
    label: "Future upside watch",
    ticker: "GE",
    reason: "Could benefit from aerospace backlog conversion and operating leverage if execution remains strong."
  }
];

const tableBody = document.querySelector("#stockTable");
const searchInput = document.querySelector("#stockSearch");
const sectorFilter = document.querySelector("#sectorFilter");
const sortMetric = document.querySelector("#sortMetric");

function compositeScore(stock) {
  return Math.round((stock.momentum * 0.34) + (stock.value * 0.22) + (stock.news * 0.28) + (stock.risk * 0.16));
}

function scoreClass(value) {
  if (value >= 82) return "score-high";
  if (value >= 70) return "score-mid";
  return "score-low";
}

function renderSectors() {
  const sectors = [...new Set(stocks.map((stock) => stock.sector))].sort();
  sectors.forEach((sector) => {
    const option = document.createElement("option");
    option.value = sector;
    option.textContent = sector;
    sectorFilter.append(option);
  });
}

function renderTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedSector = sectorFilter.value;
  const metric = sortMetric.value;

  const filtered = stocks
    .filter((stock) => selectedSector === "all" || stock.sector === selectedSector)
    .filter((stock) => [stock.ticker, stock.company, stock.sector, stock.industry].some((field) => field.toLowerCase().includes(searchTerm)))
    .sort((a, b) => {
      if (metric === "score") return compositeScore(b) - compositeScore(a);
      if (metric === "risk") return b.risk - a.risk;
      return b[metric] - a[metric];
    });

  tableBody.innerHTML = filtered.map((stock) => {
    const score = compositeScore(stock);
    return `
      <tr>
        <td>${stock.ticker}<small>${stock.sector}</small></td>
        <td>${stock.company}</td>
        <td>${stock.industry}</td>
        <td><span class="score-pill ${scoreClass(stock.momentum)}">${stock.momentum}</span></td>
        <td><span class="score-pill ${scoreClass(stock.value)}">${stock.value}</span></td>
        <td><span class="score-pill ${scoreClass(stock.news)}">${stock.news}</span></td>
        <td><span class="score-pill ${scoreClass(stock.risk)}">${stock.risk}</span></td>
        <td><span class="score-pill ${scoreClass(score)}">${score}</span></td>
      </tr>`;
  }).join("");
}

function renderNews() {
  document.querySelector("#dailyNews").innerHTML = dailyNews.map(([tag, text]) => `
    <article class="story">
      <span class="tag">${tag}</span>
      <h3>${tag} watch</h3>
      <p>${text}</p>
    </article>
  `).join("");
}

function renderIndustries() {
  document.querySelector("#industryGrid").innerHTML = industries.map((industry) => `
    <article class="industry-card">
      <div class="icon" aria-hidden="true">${industry.icon}</div>
      <h3>${industry.title}</h3>
      <p>${industry.text}</p>
      <ul>${industry.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function renderPicks() {
  document.querySelector("#pickGrid").innerHTML = picks.map((pick) => `
    <article class="pick-card ${pick.type || ""}">
      <div class="pick-meta">
        <div>
          <span>${pick.label}</span>
          <strong>${pick.ticker}</strong>
        </div>
      </div>
      <p>${pick.reason}</p>
    </article>
  `).join("");
}

[searchInput, sectorFilter, sortMetric].forEach((control) => control.addEventListener("input", renderTable));

renderSectors();
renderTable();
renderNews();
renderIndustries();
renderPicks();
