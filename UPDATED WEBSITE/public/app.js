const state = {
  assets: [],
  sideA: [],
  sideB: [],
  position: "ALL",
  query: ""
};

const els = {
  assetList: document.querySelector("#assetList"),
  sideA: document.querySelector("#sideA"),
  sideB: document.querySelector("#sideB"),
  totalA: document.querySelector("#totalA"),
  totalB: document.querySelector("#totalB"),
  difference: document.querySelector("#difference"),
  diffLabel: document.querySelector("#diffLabel"),
  verdict: document.querySelector("#verdict"),
  assetCount: document.querySelector("#assetCount"),
  searchInput: document.querySelector("#searchInput"),
  positionFilter: document.querySelector("#positionFilter"),
  clearButton: document.querySelector("#clearButton"),
  template: document.querySelector("#assetTemplate")
};

const fmt = new Intl.NumberFormat("en-US");

async function loadAssets() {
  const response = await fetch("/api/assets");
  state.assets = await response.json();
  els.assetCount.textContent = `${state.assets.length} assets`;
  renderAssets();
  evaluateTrade();
}

function assetSubtitle(asset) {
  const age = asset.age ? `Age ${asset.age}` : "Rookie pick";
  return `${asset.position} | ${asset.team} | Tier ${asset.tier} | ${age}`;
}

function renderAssets() {
  const query = state.query.toLowerCase();
  const filtered = state.assets.filter((asset) => {
    const matchesPosition = state.position === "ALL" || asset.position === state.position;
    const matchesQuery = [asset.name, asset.team, asset.position]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return matchesPosition && matchesQuery;
  });

  els.assetList.replaceChildren();
  for (const asset of filtered) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = asset.name;
    node.querySelector("p").textContent = assetSubtitle(asset);
    node.querySelector("strong").textContent = fmt.format(asset.value);
    node.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => addAsset(button.dataset.add, asset.id));
    });
    els.assetList.append(node);
  }
}

function addAsset(side, id) {
  const key = side === "A" ? "sideA" : "sideB";
  if (!state[key].includes(id)) {
    state[key].push(id);
    renderTradeSide(key);
    evaluateTrade();
  }
}

function removeAsset(key, id) {
  state[key] = state[key].filter((item) => item !== id);
  renderTradeSide(key);
  evaluateTrade();
}

function renderTradeSide(key) {
  const target = key === "sideA" ? els.sideA : els.sideB;
  const selected = state[key]
    .map((id) => state.assets.find((asset) => asset.id === id))
    .filter(Boolean);

  target.replaceChildren();
  if (!selected.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Add assets from the market below.";
    target.append(empty);
    return;
  }

  for (const asset of selected) {
    const row = document.createElement("button");
    row.className = "selected-asset";
    row.type = "button";
    row.innerHTML = `<span>${asset.name}</span><strong>${fmt.format(asset.value)}</strong>`;
    row.addEventListener("click", () => removeAsset(key, asset.id));
    target.append(row);
  }
}

async function evaluateTrade() {
  renderTradeSide("sideA");
  renderTradeSide("sideB");
  const response = await fetch("/api/trade/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sideA: state.sideA, sideB: state.sideB })
  });
  const data = await response.json();
  els.totalA.textContent = fmt.format(data.sideA.total);
  els.totalB.textContent = fmt.format(data.sideB.total);
  els.difference.textContent = fmt.format(Math.abs(data.difference));
  els.diffLabel.textContent =
    data.difference === 0 ? "Even" : data.difference > 0 ? "Side A edge" : "Side B edge";
  els.verdict.textContent = data.verdict;
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderAssets();
});

els.positionFilter.addEventListener("change", (event) => {
  state.position = event.target.value;
  renderAssets();
});

els.clearButton.addEventListener("click", () => {
  state.sideA = [];
  state.sideB = [];
  evaluateTrade();
});

loadAssets();
