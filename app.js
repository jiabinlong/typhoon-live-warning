const canvas = document.getElementById("trackCanvas");
const ctx = canvas.getContext("2d");
let activeStorm = null;
const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
const shown = (value, suffix = "") => value == null ? `--${suffix}` : `${value}${suffix}`;
const direction = value => ({ 北西: "西北", 南西: "西南", 北东: "东北", 南东: "东南" }[value] || value || "未知");

function formatTime(value) {
  if (!value) return "时间未知";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}+08:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
function risk(level = 0) {
  if (level >= 16) return ["red", "极高风险提示", "风力极强，请立即关注当地官方预警"];
  if (level >= 12) return ["orange", "高风险提示", "风力较强，请做好防风避险准备"];
  if (level >= 10) return ["yellow", "较高风险提示", "可能出现明显大风，请减少户外活动"];
  return ["blue", "关注提示", "请持续关注台风动向和当地官方信息"];
}

function renderStorm(storm, source) {
  activeStorm = storm;
  const current = storm.current;
  const [riskKey, riskLabel, riskTitle] = risk(current.windLevel);
  setText("storm-title", `台风“${storm.name}”`);
  setText("stormSubtitle", `${storm.id} · ${storm.englishName} · ${current.intensity}`);
  setText("observedAt", `实况时间：${formatTime(current.time)}`);
  document.getElementById("heroSummary").innerHTML = storm.bulletin
    ? `${storm.bulletin}。当前向<strong>${direction(current.moveDirection)}</strong>方向移动，速度约<strong>${shown(current.moveSpeed, " 公里/小时")}</strong>。`
    : `中心位于<strong>${current.latitude}°N, ${current.longitude}°E</strong>，向<strong>${direction(current.moveDirection)}</strong>方向移动，速度约<strong>${shown(current.moveSpeed, " 公里/小时")}</strong>。`;
  setText("windLevel", shown(current.windLevel)); setText("windSpeed", shown(current.windSpeed, " 米/秒"));
  setText("positionValue", `${current.latitude}°N, ${current.longitude}°E`); setText("positionDetail", storm.positionDescription || "位置描述暂缺");
  setText("directionValue", `${direction(current.moveDirection)}方向`); setText("moveSpeedValue", shown(current.moveSpeed, " 公里/小时"));
  setText("pressureValue", shown(current.pressure, " hPa")); setText("intensityValue", current.intensity); setText("radiusValue", shown(current.radius7, " km"));
  setText("riskBadge", `${riskLabel} · 非官方预警`); setText("riskTime", `${formatTime(current.time)} 实况`);
  document.getElementById("warning-title").innerHTML = `${riskTitle}<br><small>平台辅助判断</small>`;
  document.querySelectorAll(".warning-levels button").forEach(button => button.classList.toggle("active", button.dataset.level === riskKey));
  setText("dataStatus", "真实数据已载入");
  setText("dataBanner", `数据来源：${source.name}｜实况时间：${formatTime(current.time)}｜平台风险提示不等同官方预警`);
  document.getElementById("dataBanner").classList.add("live-banner");
  renderForecast(storm); drawTrack();
}

function renderForecast(storm) {
  const list = document.getElementById("forecastTimeline");
  const points = storm.forecast.slice(0, 4);
  if (!points.length) { list.innerHTML = `<li><time>暂无预测点</time><strong>仅展示已发布实况路径</strong><span>请关注官方后续更新</span></li>`; return; }
  list.innerHTML = points.map(point => `<li><time>${formatTime(point.time)}</time><strong>${point.intensity} · ${shown(point.windLevel, "级")}</strong><span>${storm.forecastAgency || "预报机构"}预测</span></li>`).join("");
  list.style.gridTemplateColumns = `repeat(${points.length}, 1fr)`;
}

function noStorm(source) {
  setText("storm-title", "当前无活动台风"); setText("stormSubtitle", "西北太平洋及南海暂无活动台风记录");
  setText("heroSummary", "系统仍会每 15 分钟检查一次数据。请继续关注当地气象部门发布的预警信息。");
  setText("dataStatus", "暂无活动台风"); setText("dataBanner", `数据来源：${source.name}｜当前无活动台风｜每 15 分钟自动检查`);
  document.getElementById("dataBanner").classList.add("live-banner"); drawTrack();
}
function dataError() {
  setText("dataStatus", "数据读取失败"); setText("dataBanner", "实时数据暂时不可用，请直接查看当地气象部门发布的信息");
  setText("storm-title", "实时数据暂不可用"); setText("heroSummary", "页面未能读取最新数据。为避免误导，当前不显示过期实况。");
  document.getElementById("dataBanner").classList.add("error-banner");
}

function drawTrack() {
  const rect = canvas.getBoundingClientRect(), scale = window.devicePixelRatio || 1, w = rect.width, h = rect.height;
  canvas.width = w * scale; canvas.height = h * scale; ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#b9dad2"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * .7, 0); ctx.bezierCurveTo(w * .63, h * .1, w * .48, h * .16, w * .34, h * .27); ctx.bezierCurveTo(w * .22, h * .36, w * .1, h * .38, 0, h * .45); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(69,130,137,.14)"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  if (!activeStorm) return;
  const observed = activeStorm.track.slice(-30), all = [...observed, ...activeStorm.forecast]; if (!all.length) return;
  const lngs = all.map(p => p.longitude), lats = all.map(p => p.latitude);
  let minX = Math.min(...lngs), maxX = Math.max(...lngs), minY = Math.min(...lats), maxY = Math.max(...lats);
  const px = Math.max((maxX - minX) * .18, 1), py = Math.max((maxY - minY) * .18, 1); minX -= px; maxX += px; minY -= py; maxY += py;
  const project = p => [35 + (p.longitude - minX) / (maxX - minX) * (w - 70), h - 28 - (p.latitude - minY) / (maxY - minY) * (h - 56)];
  const line = (points, color, dashed, includeStart) => { if (!points.length) return; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash(dashed ? [8, 7] : []); ctx.beginPath(); if (includeStart) ctx.moveTo(...project(observed.at(-1))); points.forEach((p, i) => i || includeStart ? ctx.lineTo(...project(p)) : ctx.moveTo(...project(p))); ctx.stroke(); ctx.setLineDash([]); };
  line(observed, "#f47b20", false, false); line(activeStorm.forecast, "#176ff2", true, true);
  [...observed.filter((_, i) => i % Math.max(1, Math.ceil(observed.length / 10)) === 0), observed.at(-1), ...activeStorm.forecast].filter(Boolean).forEach(p => { const [x, y] = project(p); ctx.beginPath(); ctx.arc(x, y, p === observed.at(-1) ? 8 : 4, 0, Math.PI * 2); ctx.fillStyle = p.phase === "forecast" ? "#fff" : "#f47b20"; ctx.fill(); ctx.strokeStyle = p.phase === "forecast" ? "#176ff2" : "#fff"; ctx.lineWidth = 2; ctx.stroke(); });
}

const advice = { blue: ["持续关注最新实况和当地官方预警。", "检查门窗，提前收好阳台易坠物品。", "准备手电、充电设备和常用药品。"], yellow: ["减少不必要的户外活动。", "海上作业人员及时关注回港通知。", "关注停航、停课和交通调整信息。"], orange: ["停止非必要的户外活动。", "远离海岸、河口、低洼地带及临时搭建物。", "加固门窗，准备照明和饮用水。", "密切关注撤离通知。"], red: ["立即进入坚固建筑物内避险。", "严格执行当地政府发布的撤离指令。", "远离门窗、海边、河道及积水区域。", "保持通信畅通。"] };
document.querySelectorAll(".warning-levels button").forEach(button => button.addEventListener("click", () => { document.querySelectorAll(".warning-levels button").forEach(item => item.classList.remove("active")); button.classList.add("active"); document.getElementById("adviceList").innerHTML = advice[button.dataset.level].map(item => `<li>${item}</li>`).join(""); }));
document.getElementById("locationButton").addEventListener("click", () => setText("locationText", "浙江沿海"));
window.addEventListener("resize", drawTrack);
fetch(`data/typhoon.json?v=${Date.now()}`, { cache: "no-store" }).then(response => { if (!response.ok) throw new Error(response.status); return response.json(); }).then(data => { const storm = data.storms.find(item => item.id === data.currentStormId) || data.storms[0]; storm ? renderStorm(storm, data.source) : noStorm(data.source); }).catch(dataError);
