/* gen-svg.cjs — 进度数据 + 计划 → progress.svg(静态、自包含,GitHub 主页可直接渲染)
 * 读 data/tracks.json + data/tasks.json + data/progress.json,生成 progress.svg。 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const tracks = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tracks.json"), "utf8"));
const tasks = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tasks.json"), "utf8"));
let progress = { doneDates: {}, minutesByDate: {} };
try { progress = JSON.parse(fs.readFileSync(path.join(ROOT, "data/progress.json"), "utf8")); } catch (e) {}

function parseLocal(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function fmtISO(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

var done = function (d) { return progress.doneDates && progress.doneDates[d] === true; };
var todayISO = fmtISO(new Date());

var sorted = tasks.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
var dates = sorted.map(function (t) { return t.date; });
var startD = dates[0], endD = dates[dates.length - 1];
var total = tasks.length;
var doneArr = sorted.map(function (t) { return done(t.date); });
var doneN = doneArr.filter(Boolean).length;
var longest = 0, run = 0; doneArr.forEach(function (x) { if (x) { run++; if (run > longest) longest = run; } else run = 0; });
var cur = 0; for (var i = sorted.length - 1; i >= 0; i--) { if (sorted[i].date > todayISO) continue; if (done(sorted[i].date)) { cur++; continue; } if (sorted[i].date === todayISO) continue; break; }
var pct = total ? Math.round(doneN / total * 100) : 0;
var totalMin = Object.keys(progress.minutesByDate || {}).reduce(function (a, k) { return a + (+progress.minutesByDate[k] || 0); }, 0);
var hours = Math.round(totalMin / 60);

var byTrack = tracks.map(function (tr) {
  var ts = tasks.filter(function (t) { return t.trackId === tr.id; });
  var dn = ts.filter(function (t) { return done(t.date); }).length;
  return { id: tr.id, label: tr.label, color: tr.color, total: ts.length, done: dn, pct: ts.length ? Math.round(dn / ts.length * 100) : 0 };
});

// 语言:LANG_OUT=en 出英文标签(对联始终中文)
var LANG = process.env.LANG_OUT === "en" ? "en" : "zh";
var EN = { demo: "Demo", robotic: "Robotics", eeg: "Papers / Theory", ai: "AI · Repr.", review: "Synthesis" };
var L = {
  zh: { stats: ["已完成", "完成率", "当前连续", "累计学时"], hm: "打卡热力图", done: "已完成", todo: "待办" },
  en: { stats: ["completed", "progress", "streak", "hours"], hm: "study heatmap", done: "done", todo: "todo" },
}[LANG];
function trackLabel(t) { return LANG === "en" ? (EN[t.id] || t.id) : t.label; }

// 轨道色:把 var(--x) 映射成实际 hex(SVG 不认 CSS 变量)
var COL = { "var(--teal)": "#0E9E8E", "var(--green)": "#1D9E75", "var(--orange)": "#D85A30", "var(--blue)": "#4F7396", "var(--text-muted)": "#8a8a84" };
function col(c) { return COL[c] || c; }

// 热力图格子(顺序打包:第 i 个学习日 = 第 floor(i/7) 列、第 i%7 行,
// 首个任务=左上第一格,逐列自上而下填充。工作日计划,不按自然周对齐,避免首格空置)
var cells = [];
sorted.forEach(function (t, i) {
  var ds = t.date;
  var fill = done(ds) ? "#1D9E75" : (ds < todayISO ? "#efe3df" : "#e4e2db");
  cells.push({ wk: Math.floor(i / 7), d: i % 7, fill: fill });
});
var wk = Math.ceil(sorted.length / 7);

// ── 布局 + 出 SVG ──
var W = 880, H = 250, SERIF = "'Noto Serif SC','Songti SC',Georgia,serif", MONO = "'JetBrains Mono',ui-monospace,monospace", SANS = "'Noto Sans SC',sans-serif";
var s = '';
s += '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg">';
s += '<title>学习追踪</title><desc>打卡热力图、统计、按轨道进度与荣枯鉴对联。</desc>';
s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="16" fill="#fafaf8" stroke="#e8e6df"/>';

// 左下:荣枯鉴对联(小字,前两句,放在热力图下面)
var coup = ["富贵有常,其道乃实", "福祸非命,其道乃察"];
coup.forEach(function (line, i) {
  s += '<text x="44" y="' + (188 + i * 20) + '" font-family="' + SERIF + '" font-size="14" fill="#7a786f" letter-spacing="0.03em">' + esc(line) + '</text>';
});
// 左上:热力图
s += '<text x="44" y="46" font-family="' + MONO + '" font-size="11" letter-spacing="0.1em" fill="#8a8a84">' + L.hm + ' <tspan fill="#D85A30">' + doneN + ' / ' + total + '</tspan></text>';
var hx = 44, hy = 58, step = 13, cs = 11;
cells.forEach(function (c) {
  s += '<rect x="' + (hx + c.wk * step) + '" y="' + (hy + c.d * step) + '" width="' + cs + '" height="' + cs + '" rx="2" fill="' + c.fill + '"/>';
});
var legY = hy + 7 * step + 14;
s += '<g font-family="' + MONO + '" font-size="11" fill="#8a8a84">';
s += '<rect x="44" y="' + (legY - 9) + '" width="11" height="11" rx="2" fill="#1D9E75"/><text x="60" y="' + legY + '">' + L.done + '</text>';
s += '<rect x="108" y="' + (legY - 9) + '" width="11" height="11" rx="2" fill="#e4e2db"/><text x="124" y="' + legY + '">' + L.todo + '</text>';
s += '</g>';

// 右:统计
var statsX = 440, sv = [[doneN + ' / ' + total, L.stats[0]], [pct + "%", L.stats[1]], [String(cur), L.stats[2]], [hours + "h", L.stats[3]]];
sv.forEach(function (st, i) {
  var x = statsX + i * 112;
  s += '<text x="' + x + '" y="46" font-family="' + SERIF + '" font-weight="900" font-size="26" fill="#D85A30">' + esc(st[0]) + '</text>';
  s += '<text x="' + x + '" y="64" font-family="' + MONO + '" font-size="10" letter-spacing="0.05em" fill="#8a8a84">' + esc(st[1]) + '</text>';
});
// 右:按轨道
byTrack.forEach(function (t, i) {
  var rowY = 96 + i * 26, c = col(t.color);
  s += '<circle cx="446" cy="' + (rowY - 4) + '" r="4.5" fill="' + c + '"/>';
  s += '<text x="458" y="' + rowY + '" font-family="' + SANS + '" font-size="13" fill="#5F5E5A">' + esc(trackLabel(t)) + '</text>';
  s += '<rect x="572" y="' + (rowY - 7) + '" width="190" height="6" rx="3" fill="#eceae3"/>';
  s += '<rect x="572" y="' + (rowY - 7) + '" width="' + Math.round(190 * t.pct / 100) + '" height="6" rx="3" fill="' + c + '"/>';
  s += '<text x="772" y="' + rowY + '" font-family="' + MONO + '" font-size="11" fill="#8a8a84"><tspan fill="#2C2C2A">' + t.done + '</tspan>/' + t.total + ' · ' + t.pct + '%</text>';
});

s += '</svg>\n';
fs.writeFileSync(path.join(ROOT, "progress.svg"), s);
console.log("✓ progress.svg written | done", doneN + "/" + total, "| hours", hours, "| weeks", wk, "| cells", cells.length);
