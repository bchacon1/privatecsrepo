const CONSTITUENTS_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";
const GDELT_URL = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({
  query: '("S&P 500" OR "stock market") sourceCountry:US',
  mode: "artlist",
  format: "json",
  maxrecords: "20",
  sort: "datedesc"
}).toString()}`;
const STORAGE_KEY = "sp500-signal-desk-fmp-key";
const SCORE_WEIGHTS = { momentum: 0.35, valuation: 0.25, news: 0.2, risk: 0.2 };
const FALLBACK_TIME = new Date("2026-05-16T00:00:00Z");

const fallbackConstituents = [
  { symbol: "NVDA", name: "NVIDIA", sector: "Information Technology", subIndustry: "Semiconductors", prices: [843, 857, 881, 902, 924, 941, 955], pe: 68, beta: 1.7, marketCap: 2350000000000 },
  { symbol: "MSFT", name: "Microsoft", sector: "Information Technology", subIndustry: "Systems Software", prices: [410, 414, 418, 421, 426, 429, 431], pe: 36, beta: 0.9, marketCap: 3200000000000 },
  { symbol: "LLY", name: "Eli Lilly", sector: "Health Care", subIndustry: "Pharmaceuticals", prices: [742, 755, 763, 779, 790, 807, 812], pe: 57, beta: 0.4, marketCap: 770000000000 },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", subIndustry: "Integrated Oil & Gas", prices: [116, 117, 118, 117, 119, 120, 121], pe: 14, beta: 0.9, marketCap: 525000000000 },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", subIndustry: "Diversified Banks", prices: [198, 201, 204, 207, 209, 211, 212], pe: 13, beta: 1.1, marketCap: 610000000000 },
  { symbol: "COST", name: "Costco", sector: "Consumer Staples", subIndustry: "Consumer Staples Merchandise Retail", prices: [714, 718, 721, 727, 731, 735, 738], pe: 48, beta: 0.8, marketCap: 327000000000 },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials", subIndustry: "Aerospace & Defense", prices: [152, 155, 158, 162, 166, 170, 172], pe: 38, beta: 1.2, marketCap: 185000000000 },
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", subIndustry: "Electric Utilities", prices: [64, 65, 66, 66, 67, 67, 68], pe: 20, beta: 0.6, marketCap: 140000000000 },
  { symbol: "AVGO", name: "Broadcom", sector: "Information Technology", subIndustry: "Semiconductors", prices: [1290, 1312, 1340, 1375, 1398, 1410, 1432], pe: 52, beta: 1.3, marketCap: 660000000000 },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Health Care", subIndustry: "Managed Health Care", prices: [508, 511, 510, 516, 520, 524, 527], pe: 21, beta: 0.7, marketCap: 485000000000 },
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", subIndustry: "Construction Machinery", prices: [330, 335, 337, 339, 341, 344, 346], pe: 17, beta: 1.0, marketCap: 168000000000 },
  { symbol: "SLB", name: "SLB", sector: "Energy", subIndustry: "Oil & Gas Equipment & Services", prices: [47, 47.5, 48.2, 48, 49.4, 50, 50.3], pe: 18, beta: 1.5, marketCap: 72000000000 }
];

const sectorKeywords = {
  Energy: ["oil", "gas", "energy", "crude", "lng"],
  "AI & Technology": ["ai", "chip", "cloud", "software", "semiconductor", "cyber"],
  "Medicine & Healthcare": ["drug", "medicine", "health", "pharma", "biotech", "device"],
  Financials: ["bank", "credit", "payments", "insurance", "rates"],
  Consumer: ["consumer", "retail", "spending", "staples", "discretionary"],
  Industrials: ["industrial", "aerospace", "transport", "manufacturing", "defense"],
  Utilities: ["utility", "power", "grid", "electricity", "renewable"]
};

const state = {
  stocks: [],
  news: [],
  sourceStatuses: [],
  dataMode: "loading",
  lastUpdated: null,
  apiKey: localStorage.getItem(STORAGE_KEY) || "",
  loadedCount: 0,
  totalCount: 0
};

const elements = {
  apiForm: document.querySelector("#apiForm"),
  apiKey: document.querySelector("#apiKey"),
  clearKey: document.querySelector("#clearKey"),
  sourceList: document.querySelector("#sourceList"),
  stockTable: document.querySelector("#stockTable"),
  stockSearch: document.querySelector("#stockSearch"),
  sectorFilter: document.querySelector("#sectorFilter"),
  sortMetric: document.querySelector("#sortMetric"),
  statusMode: document.querySelector("#statusMode"),
  marketScore: document.querySelector("#marketScore"),
  marketSummary: document.querySelector("#marketSummary"),
  averageMomentum: document.querySelector("#averageMomentum"),
  positiveBreadth: document.querySelector("#positiveBreadth"),
  lastUpdated: document.querySelector("#lastUpdated"),
  dailyNews: document.querySelector("#dailyNews"),
  leadStory: document.querySelector("#leadStory"),
  industryGrid: document.querySelector("#industryGrid"),
  pickGrid: document.querySelector("#pickGrid"),
  stockDialog: document.querySelector("#stockDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  dialogContent: document.querySelector("#dialogContent")
};

elements.apiKey.value = state.apiKey;

function proxyUrl(url) {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

async function fetchTextWithFallback(url) {
  const urls = [url, proxyUrl(url)];
  let lastError;
  for (const candidate of urls) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchJsonWithFallback(url) {
  const text = await fetchTextWithFallback(url);
  return JSON.parse(text);
}

function addSource(name, status, detail) {
  state.sourceStatuses = state.sourceStatuses.filter((source) => source.name !== name);
  state.sourceStatuses.push({ name, status, detail });
  renderSources();
}

function renderSources() {
  elements.sourceList.innerHTML = state.sourceStatuses.map((source) => `
    <li class="${source.status}">${source.name}: ${source.detail}</li>
  `).join("");
}

function parseCsv(csv) {
  const rows = csv.trim().split(/\r?\n/).map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "")));
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function normalizeSymbolForYahoo(symbol) {
  return symbol.replace(".", "-");
}

function latest(values) {
  return values[values.length - 1];
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function standardDeviation(values) {
  const usable = values.filter(Number.isFinite);
  if (usable.length < 2) return null;
  const mean = average(usable);
  return Math.sqrt(average(usable.map((value) => (value - mean) ** 2)));
}

function normalize(value, min, max, invert = false) {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(Math.max(value, min), max);
  const normalized = ((clamped - min) / (max - min)) * 100;
  return Math.round(invert ? 100 - normalized : normalized);
}

function scoreClass(value) {
  if (!Number.isFinite(value)) return "missing";
  if (value >= 75) return "score-high";
  if (value >= 50) return "score-mid";
  return "score-low";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatLargeNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function calculateMetrics(stock) {
  const closes = stock.prices || [];
  const price = stock.price ?? latest(closes);
  const previousClose = stock.previousClose ?? closes[closes.length - 2];
  const dayChange = percentChange(price, previousClose);
  const monthReturn = percentChange(price, closes[0]);
  const sma20 = average(closes.slice(-20));
  const trendVsSma = Number.isFinite(sma20) ? percentChange(price, sma20) : null;
  const dailyReturns = closes.slice(1).map((close, index) => percentChange(close, closes[index])).filter(Number.isFinite);
  const volatility = standardDeviation(dailyReturns);

  const momentumInputs = [
    normalize(dayChange, -5, 5),
    normalize(monthReturn, -15, 15),
    normalize(trendVsSma, -8, 8)
  ].filter(Number.isFinite);
  const momentum = Math.round(average(momentumInputs) ?? 50);

  const valuationInputs = [
    normalize(stock.pe, 8, 45, true),
    normalize(stock.forwardPe, 8, 38, true)
  ].filter(Number.isFinite);
  const valuation = valuationInputs.length ? Math.round(average(valuationInputs)) : null;

  const news = calculateNewsScore(stock);
  const riskInputs = [
    normalize(volatility, 0.5, 5, true),
    normalize(stock.beta, 0.4, 2.2, true)
  ].filter(Number.isFinite);
  const risk = Math.round(average(riskInputs) ?? 55);

  const componentScores = { momentum, valuation, news, risk };
  const availableWeights = Object.entries(SCORE_WEIGHTS).filter(([key]) => Number.isFinite(componentScores[key]));
  const weightTotal = availableWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const composite = Math.round(availableWeights.reduce((sum, [key, weight]) => sum + componentScores[key] * (weight / weightTotal), 0));

  return { price, previousClose, dayChange, monthReturn, sma20, trendVsSma, volatility, momentum, valuation, news, risk, composite };
}

function calculateNewsScore(stock) {
  if (!state.news.length) return 50;
  const companyTerms = [stock.symbol, stock.name].map((term) => term.toLowerCase());
  const sectorTerms = (sectorKeywords[toDisplaySector(stock.sector)] || [stock.sector || ""]).map((term) => term.toLowerCase());
  let companyHits = 0;
  let sectorHits = 0;

  state.news.forEach((article) => {
    const haystack = `${article.title || ""} ${article.seendate || ""}`.toLowerCase();
    if (companyTerms.some((term) => term && haystack.includes(term))) companyHits += 1;
    if (sectorTerms.some((term) => term && haystack.includes(term))) sectorHits += 1;
  });

  return Math.min(100, 45 + companyHits * 18 + sectorHits * 5);
}

function toDisplaySector(sector = "") {
  if (sector.includes("Technology")) return "AI & Technology";
  if (sector.includes("Health")) return "Medicine & Healthcare";
  if (sector.includes("Consumer")) return "Consumer";
  return sector || "Unclassified";
}

async function loadConstituents() {
  try {
    const csv = await fetchTextWithFallback(CONSTITUENTS_URL);
    const rows = parseCsv(csv);
    addSource("S&P 500 constituents", "ok", `${rows.length} live tickers loaded`);
    return rows.map((row) => ({
      symbol: row.Symbol,
      name: row.Name,
      sector: row.Sector,
      subIndustry: row.SubIndustry || row["Sub-Industry"] || row.Industry || "S&P 500 company",
      prices: []
    })).filter((stock) => stock.symbol && stock.name);
  } catch (error) {
    addSource("S&P 500 constituents", "warn", "live list unavailable; using cached seed list");
    return fallbackConstituents.map((stock) => ({ ...stock, fallback: true }));
  }
}

async function loadChart(stock) {
  const symbol = normalizeSymbolForYahoo(stock.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;
  const data = await fetchJsonWithFallback(url);
  const result = data.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const meta = result?.meta || {};
  const closes = (quote?.close || []).filter(Number.isFinite);
  return {
    ...stock,
    prices: closes.length ? closes : stock.prices,
    price: meta.regularMarketPrice ?? latest(closes) ?? stock.price,
    previousClose: meta.previousClose ?? stock.previousClose,
    currency: meta.currency || "USD",
    livePrice: true
  };
}

async function loadFundamentals(stocks) {
  if (!state.apiKey) {
    addSource("Fundamentals", "warn", "add FMP key for P/E, beta, and market cap");
    return stocks;
  }

  try {
    const symbols = stocks.map((stock) => stock.symbol).join(",");
    const quoteUrl = `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${encodeURIComponent(state.apiKey)}`;
    const quotes = await fetchJsonWithFallback(quoteUrl);
    const bySymbol = new Map((Array.isArray(quotes) ? quotes : []).map((quote) => [quote.symbol, quote]));
    addSource("Fundamentals", "ok", `${bySymbol.size} FMP quote profiles loaded`);
    return stocks.map((stock) => {
      const quote = bySymbol.get(stock.symbol);
      if (!quote) return stock;
      return {
        ...stock,
        price: quote.price ?? stock.price,
        previousClose: quote.previousClose ?? stock.previousClose,
        pe: quote.pe ?? stock.pe,
        forwardPe: quote.eps && quote.price ? quote.price / quote.eps : stock.forwardPe,
        beta: quote.beta ?? stock.beta,
        marketCap: quote.marketCap ?? stock.marketCap,
        liveFundamentals: true
      };
    });
  } catch (error) {
    addSource("Fundamentals", "fail", "FMP request failed; scoring excludes missing fundamentals");
    return stocks;
  }
}

async function loadNews() {
  try {
    const data = await fetchJsonWithFallback(GDELT_URL);
    state.news = (data.articles || []).slice(0, 12);
    addSource("Daily news", "ok", `${state.news.length} GDELT headlines loaded`);
  } catch (error) {
    state.news = [
      { title: "Market breadth, AI spending, rates, energy, and healthcare remain key S&P 500 factors today.", sourcecountry: "US", url: "#", domain: "cached insight" },
      { title: "Fallback mode: connect to GDELT in the browser for current headlines and news scoring.", sourcecountry: "US", url: "#", domain: "cached insight" }
    ];
    addSource("Daily news", "warn", "GDELT unavailable; using labeled cached headlines");
  }
}

async function mapLimit(items, limit, mapper, onProgress) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (error) {
        results[currentIndex] = items[currentIndex];
      }
      if (onProgress) onProgress(results.filter(Boolean).length, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function refreshData() {
  state.dataMode = "loading";
  state.sourceStatuses = [];
  state.loadedCount = 0;
  state.totalCount = 0;
  renderLoading();
  renderSources();

  await loadNews();
  const constituents = await loadConstituents();
  state.totalCount = constituents.length;
  state.stocks = constituents.map((stock) => ({ ...stock, metrics: calculateMetrics(stock) }));
  populateSectors();
  renderAll();

  let pricedStocks = await mapLimit(constituents, 8, loadChart, (loaded, total) => {
    state.loadedCount = loaded;
    elements.statusMode.textContent = `Loading ${loaded}/${total}`;
  });

  const livePriceCount = pricedStocks.filter((stock) => stock.livePrice).length;
  if (livePriceCount === 0) {
    pricedStocks = fallbackConstituents.map((stock) => ({ ...stock, fallback: true }));
    addSource("Price history", "warn", "all live chart requests failed; using cached seed prices");
  }

  const withFundamentals = await loadFundamentals(pricedStocks);
  state.stocks = withFundamentals.map((stock) => ({ ...stock, metrics: calculateMetrics(stock) }));
  state.lastUpdated = new Date();
  state.dataMode = state.stocks.some((stock) => stock.livePrice || stock.liveFundamentals) ? "live" : "fallback";
  if (livePriceCount > 0) {
    addSource("Price history", "ok", `${state.stocks.filter((stock) => stock.livePrice).length} Yahoo charts loaded`);
  }
  populateSectors();
  renderAll();
}

function renderLoading() {
  elements.statusMode.textContent = "Loading...";
  elements.marketScore.textContent = "--";
  elements.marketSummary.textContent = "Connecting to live sources and calculating breadth, momentum, volatility, valuation, and news impact.";
  elements.stockTable.innerHTML = `<tr><td colspan="8">Loading live S&P 500 data...</td></tr>`;
}

function populateSectors() {
  const current = elements.sectorFilter.value;
  const sectors = [...new Set(state.stocks.map((stock) => toDisplaySector(stock.sector)))].sort();
  elements.sectorFilter.innerHTML = `<option value="all">All sectors</option>${sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join("")}`;
  elements.sectorFilter.value = sectors.includes(current) ? current : "all";
}

function filteredStocks() {
  const searchTerm = elements.stockSearch.value.trim().toLowerCase();
  const selectedSector = elements.sectorFilter.value;
  const metric = elements.sortMetric.value;
  return state.stocks
    .filter((stock) => selectedSector === "all" || toDisplaySector(stock.sector) === selectedSector)
    .filter((stock) => [stock.symbol, stock.name, stock.sector, stock.subIndustry].some((field) => (field || "").toLowerCase().includes(searchTerm)))
    .sort((a, b) => (b.metrics?.[metric] ?? -Infinity) - (a.metrics?.[metric] ?? -Infinity));
}

function renderTable() {
  const rows = filteredStocks();
  if (!rows.length) {
    elements.stockTable.innerHTML = `<tr><td colspan="8">No stocks match your filters.</td></tr>`;
    return;
  }

  elements.stockTable.innerHTML = rows.map((stock, index) => {
    const metrics = stock.metrics;
    const changeClass = metrics.dayChange >= 0 ? "positive" : "negative";
    const monthClass = metrics.monthReturn >= 0 ? "positive" : "negative";
    return `
      <tr data-symbol="${stock.symbol}">
        <td>${stock.symbol}<small>${stock.subIndustry}</small></td>
        <td>${stock.name}<small>${stock.livePrice ? "Live price" : "Cached/no price"}${stock.liveFundamentals ? " + fundamentals" : ""}</small></td>
        <td>${toDisplaySector(stock.sector)}<small>${stock.sector}</small></td>
        <td>${formatMoney(metrics.price)}</td>
        <td class="${changeClass}">${formatPercent(metrics.dayChange)}</td>
        <td class="${monthClass}">${formatPercent(metrics.monthReturn)}</td>
        <td>${Number.isFinite(stock.pe) ? stock.pe.toFixed(1) : "<span class='missing'>Needs key</span>"}</td>
        <td><span class="score-pill ${scoreClass(metrics.composite)}">${metrics.composite}</span></td>
      </tr>`;
  }).join("");

  elements.stockTable.querySelectorAll("tr[data-symbol]").forEach((row) => {
    row.addEventListener("click", () => openStockDialog(row.dataset.symbol));
  });
}

function renderMarketPulse() {
  const scores = state.stocks.map((stock) => stock.metrics?.composite).filter(Number.isFinite);
  const avgComposite = Math.round(average(scores) ?? 0);
  const avgMomentum = Math.round(average(state.stocks.map((stock) => stock.metrics?.momentum).filter(Number.isFinite)) ?? 0);
  const dayChanges = state.stocks.map((stock) => stock.metrics?.dayChange).filter(Number.isFinite);
  const positive = dayChanges.filter((value) => value > 0).length;
  const breadth = dayChanges.length ? Math.round((positive / dayChanges.length) * 100) : 0;
  const modeLabel = state.dataMode === "live" ? "Live" : state.dataMode === "fallback" ? "Fallback" : `Loading ${state.loadedCount}/${state.totalCount || ""}`;

  elements.statusMode.textContent = modeLabel;
  elements.marketScore.textContent = avgComposite || "--";
  elements.averageMomentum.textContent = avgMomentum || "--";
  elements.positiveBreadth.textContent = dayChanges.length ? `${breadth}%` : "--";
  elements.lastUpdated.textContent = (state.lastUpdated || FALLBACK_TIME).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  elements.marketSummary.textContent = dayChanges.length
    ? `${positive} of ${dayChanges.length} tracked stocks are positive today. Composite score is based on momentum, valuation when available, news impact, and risk quality.`
    : "Waiting for price data. Scores will update automatically as live endpoints respond.";
}

function renderNews() {
  const [lead, ...rest] = state.news;
  elements.leadStory.innerHTML = `
    <span class="tag">${state.dataMode === "fallback" ? "Cached" : "Current"}</span>
    <h3>${lead?.title || "No headlines available yet."}</h3>
    <p>${lead?.domain || lead?.sourcecountry || "GDELT"} · News score counts company and sector mentions from today's headline set.</p>
  `;
  elements.dailyNews.innerHTML = rest.slice(0, 6).map((article) => `
    <article class="story">
      <span class="tag">${article.sourcecountry || "Market"}</span>
      <h3>${article.title}</h3>
      <p>${article.domain || "GDELT"}${article.url && article.url !== "#" ? ` · <a href="${article.url}" target="_blank" rel="noreferrer">Read source</a>` : ""}</p>
    </article>
  `).join("");
}

function renderIndustries() {
  const groups = [...new Set(state.stocks.map((stock) => toDisplaySector(stock.sector)))].sort();
  elements.industryGrid.innerHTML = groups.map((sector) => {
    const stocks = state.stocks.filter((stock) => toDisplaySector(stock.sector) === sector);
    const leaders = [...stocks].sort((a, b) => b.metrics.composite - a.metrics.composite).slice(0, 3);
    const avgScore = Math.round(average(stocks.map((stock) => stock.metrics.composite)) ?? 0);
    const avgReturn = average(stocks.map((stock) => stock.metrics.monthReturn).filter(Number.isFinite));
    return `
      <article class="industry-card">
        <div class="icon" aria-hidden="true">${sectorIcon(sector)}</div>
        <h3>${sector}</h3>
        <p>${stocks.length} tracked constituents · avg score ${avgScore} · 1M return ${formatPercent(avgReturn)}</p>
        <ul>${leaders.map((stock) => `<li>${stock.symbol}: ${stock.metrics.composite} composite, ${formatPercent(stock.metrics.monthReturn)} 1M</li>`).join("")}</ul>
      </article>`;
  }).join("");
}

function sectorIcon(sector) {
  if (sector.includes("Energy")) return "⚡";
  if (sector.includes("Technology") || sector.includes("AI")) return "🤖";
  if (sector.includes("Medicine") || sector.includes("Health")) return "🧬";
  if (sector.includes("Financial")) return "🏦";
  if (sector.includes("Consumer")) return "🛒";
  if (sector.includes("Industrial")) return "🏭";
  if (sector.includes("Utilities")) return "🔌";
  return "📈";
}

function selectPicks() {
  const ranked = [...state.stocks].filter((stock) => Number.isFinite(stock.metrics?.composite));
  const byComposite = [...ranked].sort((a, b) => b.metrics.composite - a.metrics.composite);
  const byDay = [...ranked].sort((a, b) => (b.metrics.dayChange ?? -Infinity) - (a.metrics.dayChange ?? -Infinity));
  const byMonth = [...ranked].sort((a, b) => (b.metrics.monthReturn ?? -Infinity) - (a.metrics.monthReturn ?? -Infinity));
  const byUpside = [...ranked].sort((a, b) => upsideScore(b) - upsideScore(a));

  return [
    { label: "Stock of the day", stock: byDay[0], featured: true, reason: "Highest current-day move among tracked S&P 500 names, filtered through the full composite model." },
    { label: "Stock of the week", stock: byComposite[0], reason: "Best overall blend of momentum, valuation if available, news impact, and risk quality." },
    { label: "Stock of the month", stock: byMonth[0], reason: "Strongest one-month price trend from the live or cached price-history feed." },
    { label: "Future upside watch", stock: byUpside[0], reason: "Screened for strong momentum/news with relatively better valuation and risk quality. This is a watchlist idea, not a prediction." }
  ].filter((pick) => pick.stock);
}

function upsideScore(stock) {
  const metrics = stock.metrics;
  return metrics.momentum * 0.35 + metrics.news * 0.25 + (metrics.valuation ?? 50) * 0.25 + metrics.risk * 0.15;
}

function renderPicks() {
  const picks = selectPicks();
  elements.pickGrid.innerHTML = picks.map((pick) => `
    <article class="pick-card ${pick.featured ? "featured" : ""}">
      <div class="pick-meta">
        <div>
          <span>${pick.label}</span>
          <strong>${pick.stock.symbol}</strong>
        </div>
        <span class="score-pill ${scoreClass(pick.stock.metrics.composite)}">${pick.stock.metrics.composite}</span>
      </div>
      <p>${pick.stock.name} · ${toDisplaySector(pick.stock.sector)}</p>
      <small>${pick.reason} Today: ${formatPercent(pick.stock.metrics.dayChange)} · 1M: ${formatPercent(pick.stock.metrics.monthReturn)} · P/E: ${Number.isFinite(pick.stock.pe) ? pick.stock.pe.toFixed(1) : "not loaded"}.</small>
    </article>
  `).join("");
}

function openStockDialog(symbol) {
  const stock = state.stocks.find((item) => item.symbol === symbol);
  if (!stock) return;
  const metrics = stock.metrics;
  elements.dialogContent.innerHTML = `
    <section class="dialog-body">
      <p class="eyebrow">Score breakdown</p>
      <h2 id="dialogTitle">${stock.symbol} · ${stock.name}</h2>
      <p>${stock.subIndustry} · ${toDisplaySector(stock.sector)} · Source: ${stock.livePrice ? "live Yahoo chart" : "cached/no live chart"}${stock.liveFundamentals ? " + FMP fundamentals" : ""}</p>
      <div class="metric-grid">
        <div><span>Composite</span><strong>${metrics.composite}</strong></div>
        <div><span>Momentum</span><strong>${metrics.momentum}</strong></div>
        <div><span>Valuation</span><strong>${Number.isFinite(metrics.valuation) ? metrics.valuation : "Excluded"}</strong></div>
        <div><span>News</span><strong>${metrics.news}</strong></div>
        <div><span>Risk quality</span><strong>${metrics.risk}</strong></div>
        <div><span>Price</span><strong>${formatMoney(metrics.price)}</strong></div>
        <div><span>Today</span><strong>${formatPercent(metrics.dayChange)}</strong></div>
        <div><span>1M</span><strong>${formatPercent(metrics.monthReturn)}</strong></div>
      </div>
      <h3>How this number was produced</h3>
      <ul class="breakdown">
        <li>Momentum = average of normalized daily move, one-month return, and price versus 20-day average.</li>
        <li>Valuation = normalized P/E and forward P/E when an FMP key provides those fields; missing valuation is not fabricated.</li>
        <li>News = company and sector headline hits from today&apos;s GDELT article set.</li>
        <li>Risk = lower realized volatility and lower beta receive higher scores.</li>
      </ul>
    </section>`;
  elements.stockDialog.showModal();
}

function renderAll() {
  renderMarketPulse();
  renderTable();
  renderNews();
  renderIndustries();
  renderPicks();
}

elements.apiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.apiKey = elements.apiKey.value.trim();
  if (state.apiKey) localStorage.setItem(STORAGE_KEY, state.apiKey);
  refreshData();
});

elements.clearKey.addEventListener("click", () => {
  state.apiKey = "";
  elements.apiKey.value = "";
  localStorage.removeItem(STORAGE_KEY);
  refreshData();
});

[elements.stockSearch, elements.sectorFilter, elements.sortMetric].forEach((control) => control.addEventListener("input", renderTable));
elements.closeDialog.addEventListener("click", () => elements.stockDialog.close());

refreshData();
