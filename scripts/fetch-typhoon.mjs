import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = "https://typhoon.slt.zj.gov.cn/Api";
const SOURCE_URL = "https://typhoon.slt.zj.gov.cn/";
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), "../data/typhoon.json");
const headers = { Accept: "application/json", Referer: SOURCE_URL, "User-Agent": "typhoon-live-warning/1.0 (+GitHub Actions)" };

async function getJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
function radius(value) {
  const values = String(value || "").split("|").map(Number).filter(item => item > 0);
  return values.length ? Math.max(...values) : null;
}
function point(item, phase = "observed") {
  return { time: item.time || null, longitude: num(item.lng), latitude: num(item.lat), intensity: item.strong || "未知", windLevel: num(item.power), windSpeed: num(item.speed), pressure: num(item.pressure), moveSpeed: num(item.movespeed), moveDirection: item.movedirection && item.movedirection !== "0" ? item.movedirection : "未知", radius7: radius(item.radius7), phase };
}
function normalize(info) {
  const rawPoints = Array.isArray(info.points) ? info.points : [];
  if (!rawPoints.length) return null;
  const latest = rawPoints.at(-1);
  const agencies = Array.isArray(latest.forecast) ? latest.forecast : [];
  const agency = agencies.find(item => item.tm === "中国") || agencies[0];
  const forecastRaw = Array.isArray(agency?.forecastpoints) ? agency.forecastpoints : [];
  return {
    id: String(info.tfid || ""), name: info.name || "未命名", englishName: info.enname || "NAMELESS",
    active: String(info.isactive) === "1", startTime: info.starttime || null, endTime: info.endtime || null,
    sourceWarningFlag: info.warnlevel || null, current: point(latest),
    positionDescription: String(latest.ckposition || "").trim() || null,
    bulletin: String(latest.jl || "").trim() || null,
    track: rawPoints.map(item => point(item)).filter(item => item.latitude !== null && item.longitude !== null),
    forecastAgency: agency?.tm || null,
    forecast: forecastRaw.filter(item => item && item.time !== latest.time).map(item => point(item, "forecast")).filter(item => item.latitude !== null && item.longitude !== null),
  };
}

async function main() {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric" }).format(new Date());
  const list = await getJSON(`${API_ROOT}/TyphoonList/${year}`);
  if (!Array.isArray(list)) throw new Error("台风列表返回格式异常");
  const active = list.filter(item => String(item.isactive) === "1");
  const storms = (await Promise.all(active.map(item => getJSON(`${API_ROOT}/TyphoonInfo/${item.tfid}`))))
    .map(normalize).filter(Boolean).sort((a, b) => String(b.current.time).localeCompare(String(a.current.time)));
  const data = { schemaVersion: 1, fetchedAt: new Date().toISOString(), source: { name: "浙江省台风路径实时发布系统", publisher: "浙江省水利厅", url: SOURCE_URL }, status: storms.length ? "active" : "no-active-typhoon", currentStormId: storms[0]?.id || null, storms };
  let previous = null;
  try { previous = JSON.parse(await readFile(outputPath, "utf8")); } catch {}
  const stable = value => JSON.stringify({ ...value, fetchedAt: undefined });
  if (previous && stable(previous) === stable(data)) return console.log("上游数据未变化。");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`已写入 ${storms.length} 个活动台风。`);
}
main().catch(error => { console.error(`抓取失败：${error.message}`); process.exitCode = 1; });
