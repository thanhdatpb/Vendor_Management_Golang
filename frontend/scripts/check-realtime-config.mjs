// ════════════════════════════════════════════════════════
//  PR-R3a — BUNDLE PRODUCTION PHẢI CÓ CẤU HÌNH REALTIME
//
//  `VITE_PUSHER_APP_KEY` được NHÚNG CỨNG vào bundle lúc `vite build`, mà repo
//  commit sẵn frontend/dist và production serve thẳng bundle đó. Ai build từ
//  máy thiếu .env sẽ đẩy lên một bản KHÔNG có realtime — dấu hiệu duy nhất là
//  một dòng console.warn không ai nhìn thấy.
//
//  Script này chặn từ CI: đọc entry bundle mà index.html đang trỏ tới, và bắt
//  buộc trong đó có key + cluster Pusher thật.
//
//  Dùng:  node scripts/check-realtime-config.mjs [thư-mục-dist]
// ════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] || 'dist');
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

let html;
try {
  html = readFileSync(join(distDir, 'index.html'), 'utf8');
} catch {
  fail(`Không đọc được ${join(distDir, 'index.html')} — đã build chưa?`);
}

// Entry bundle = file JS mà index.html nạp bằng <script type="module">
const entries = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1].replace(/^\//, ''));
if (!entries.length) fail('index.html không trỏ tới bundle JS nào.');

const assets = readdirSync(join(distDir, 'assets'));
const orphan = assets.filter((f) => f.endsWith('.js') && f.startsWith('index-') && !entries.some((e) => e.endsWith(f)));

let checked = 0;
let ok = false;
for (const entry of entries) {
  let code;
  try {
    code = readFileSync(join(distDir, entry), 'utf8');
  } catch {
    fail(`index.html trỏ tới ${entry} nhưng file không tồn tại trong dist.`);
  }
  checked++;

  if (!code.includes('broadcaster:"pusher"') && !code.includes("broadcaster:'pusher'")) continue;

  // Key Pusher là chuỗi hex 20 ký tự; cluster dạng "ap1", "eu", "mt1"…
  const hasKey = /["'][0-9a-f]{20}["']/.test(code);
  const hasCluster = /["'](?:ap|eu|us|mt|sa)\d?["']/.test(code);
  if (!hasKey || !hasCluster) {
    fail('Bundle có khởi tạo Pusher nhưng THIẾU key/cluster — build từ máy không có .env. '
      + 'Production sẽ mất realtime mà không có dấu hiệu nào ngoài console.warn.');
  }
  ok = true;
}

if (!ok) {
  fail(`Không tìm thấy phần khởi tạo Pusher trong ${checked} bundle của index.html — `
    + 'nhiều khả năng biến env trống nên đoạn tạo Echo bị loại khi minify.');
}

console.log(`✅ Bundle có cấu hình realtime (kiểm ${checked} entry).`);
if (orphan.length) {
  // Không fail: chỉ là rác chiếm dung lượng repo, nhưng dễ gây hiểu nhầm
  // "production đang chạy bundle nào" (PR-S5).
  console.warn(`⚠  Bundle không còn được index.html trỏ tới, nên xoá khỏi git: ${orphan.join(', ')}`);
}
