"use strict";

const TOTAL_WEIGHT = 5147;
const OSMIUM_R_VALUES = new Set([5125, 5126]);

const MULT = 0x5DEECE66Dn;
const ADD = 0xBn;
const MASK48 = (1n << 48n) - 1n;
const MASK64 = (1n << 64n) - 1n;

let latestRows = [];

function parseBigIntInput(value, name) {
  const s = String(value).trim().replaceAll(",", "").replaceAll("_", "");
  if (!/^[+-]?(?:0x[0-9a-fA-F]+|\d+)$/.test(s)) throw new Error(`${name} must be an integer.`);
  return BigInt(s);
}

function parseSafeIntInput(value, name) {
  const s = String(value).trim().replaceAll(",", "").replaceAll("_", "");
  if (!/^[+-]?\d+$/.test(s)) throw new Error(`${name} must be an integer.`);
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new Error(`${name} is too large.`);
  return n;
}

function javaRandomSeed(seed64) {
  return (seed64 ^ MULT) & MASK48;
}

function nextBits(seed48, bits) {
  seed48 = (seed48 * MULT + ADD) & MASK48;
  return [seed48, Number(seed48 >> BigInt(48 - bits))];
}

function nextIntBound(seed48, bound) {
  while (true) {
    let r;
    [seed48, r] = nextBits(seed48, 31);
    const m = r % bound;
    if (r - m + (bound - 1) >= 0) return [seed48, m];
  }
}

function chunkAsLong(chunkX, chunkZ) {
  const x = BigInt(chunkX) & 0xffffffffn;
  const z = BigInt(chunkZ) & 0xffffffffn;
  return (x | (z << 32n)) & MASK64;
}

function valueForChunk(seed, chunkX, chunkZ) {
  const mixed = (seed ^ chunkAsLong(chunkX, chunkZ)) & MASK64;
  let randomSeed = javaRandomSeed(mixed);
  let value;
  [randomSeed, value] = nextIntBound(randomSeed, TOTAL_WEIGHT);
  return value;
}

function blockToChunk(block) {
  return Math.floor(block / 16);
}

function chunkIntersectsCircle(chunkX, chunkZ, centerX, centerZ, radius) {
  const minX = chunkX * 16, maxX = chunkX * 16 + 15;
  const minZ = chunkZ * 16, maxZ = chunkZ * 16 + 15;
  let dx = 0, dz = 0;
  if (centerX < minX) dx = minX - centerX;
  else if (centerX > maxX) dx = centerX - maxX;
  if (centerZ < minZ) dz = minZ - centerZ;
  else if (centerZ > maxZ) dz = centerZ - maxZ;
  return dx * dx + dz * dz <= radius * radius;
}

function findOsmium(seed, centerX, centerZ, radius, maxResults) {
  const centerChunkX = blockToChunk(centerX);
  const centerChunkZ = blockToChunk(centerZ);
  const chunkRadius = Math.ceil(radius / 16);
  const rows = [];

  for (let chunkX = centerChunkX - chunkRadius; chunkX <= centerChunkX + chunkRadius; chunkX++) {
    for (let chunkZ = centerChunkZ - chunkRadius; chunkZ <= centerChunkZ + chunkRadius; chunkZ++) {
      if (!chunkIntersectsCircle(chunkX, chunkZ, centerX, centerZ, radius)) continue;
      const value = valueForChunk(seed, chunkX, chunkZ);
      if (!OSMIUM_R_VALUES.has(value)) continue;

      const blockX = chunkX * 16 + 8;
      const blockZ = chunkZ * 16 + 8;
      const distance = Math.hypot(blockX - centerX, blockZ - centerZ);
      rows.push({ distance, blockX, blockZ });
    }
  }

  rows.sort((a, b) => a.distance - b.distance);
  return maxResults > 0 ? rows.slice(0, maxResults) : rows;
}

function setStatus(message, type = "") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
}

function renderResults(rows) {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">No matches found.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index + 1}</td><td>${row.distance.toFixed(2)}</td><td>${row.blockX}</td><td>${row.blockZ}</td>`;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function toCsv(rows) {
  const lines = ["distance,block_x,block_z"];
  for (const row of rows) lines.push(`${row.distance.toFixed(2)},${row.blockX},${row.blockZ}`);
  return lines.join("\\n");
}

function downloadCsv() {
  if (latestRows.length === 0) return;
  const blob = new Blob([toCsv(latestRows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "osmium_results.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function runSearch() {
  const button = document.getElementById("findButton");
  const downloadButton = document.getElementById("downloadButton");

  try {
    const seed = parseBigIntInput(document.getElementById("seed").value, "Seed");
    const centerX = parseSafeIntInput(document.getElementById("centerX").value, "Center X");
    const centerZ = parseSafeIntInput(document.getElementById("centerZ").value, "Center Z");
    const radius = parseSafeIntInput(document.getElementById("radius").value, "Search Radius");
    const maxResults = parseSafeIntInput(document.getElementById("maxResults").value, "Maximum Results");

    if (radius < 0) throw new Error("Search Radius must be 0 or greater.");
    if (maxResults < 0) throw new Error("Maximum Results must be 0 or greater.");

    button.disabled = true;
    downloadButton.classList.add("hidden");
    setStatus("Searching...");

    setTimeout(() => {
      try {
        const started = performance.now();
        latestRows = findOsmium(seed, centerX, centerZ, radius, maxResults);
        const elapsed = ((performance.now() - started) / 1000).toFixed(2);
        renderResults(latestRows);
        if (latestRows.length > 0) downloadButton.classList.remove("hidden");
        setStatus(`Found ${latestRows.length.toLocaleString()} results in ${elapsed}s.`, "ok");
      } catch (error) {
        setStatus(error.message || String(error), "error");
      } finally {
        button.disabled = false;
      }
    }, 20);
  } catch (error) {
    setStatus(error.message || String(error), "error");
    button.disabled = false;
  }
}

function clearResults() {
  latestRows = [];
  renderResults([]);
  setStatus("");
  document.getElementById("downloadButton").classList.add("hidden");
}

document.getElementById("findButton").addEventListener("click", runSearch);
document.getElementById("clearButton").addEventListener("click", clearResults);
document.getElementById("downloadButton").addEventListener("click", downloadCsv);
