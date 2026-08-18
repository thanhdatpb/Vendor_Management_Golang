// ════════════════════════════════════════════════════════
//  SMOKE TEST TRÊN BUNDLE ĐÃ BUILD (T6 job "smoke")
//
//  Vì sao cần: unit test chạy trên SOURCE, còn production serve BUNDLE ĐÃ
//  MINIFY đã commit trong frontend/dist. Sự cố 2026-07-16 (conflict marker sót
//  trong dist → SyntaxError → trắng trang hoàn toàn) chỉ lộ ra ở tầng này.
//
//  Kiểm 3 việc trên bản build thật:
//    1. #root có render (childElementCount > 0) — không trắng trang
//    2. Không có exception nào khi khởi động app
//    3. Bundle không chứa conflict marker
//
//  Dùng:  node scripts/smoke-pricesheet.mjs
//  Biến môi trường: CHROME_PATH (đường dẫn Chrome), SMOKE_PORT (mặc định 4173)
//
//  CÒN THIẾU (làm trong PR-A1): lặp lại đúng thao tác kéo chuột của mục 01 trên
//  bundle thật. Cần đăng nhập + một bảng giá seed, nên phải chạy kèm backend —
//  đây là tầng duy nhất bắt được lỗi chỉ xuất hiện sau minify.
// ════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = process.env.SMOKE_PORT || '4173';
const URL = `http://127.0.0.1:${PORT}/`;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p.includes('/') || p.includes('\\')) { if (existsSync(p)) return p; }
    else return p;
  }
  return null;
}

// ── 1. Conflict marker trong bundle (chặn trước, không cần trình duyệt) ──
function checkConflictMarkers() {
  const dir = 'dist/assets';
  if (!existsSync(dir)) return fail('Chưa có dist/ — chạy `npx vite build` trước.');
  const marker = /^(<{7} |={7}$|>{7} )/m;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js') && !f.endsWith('.css')) continue;
    if (marker.test(readFileSync(join(dir, f), 'utf8'))) {
      fail(`${f} còn conflict marker — bundle hỏng sẽ làm TRẮNG TRANG production. `
        + 'Resolve ở frontend/src rồi chạy lại `npx vite build`, tuyệt đối không sửa tay bundle.');
    }
  }
}

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL);
      if (res.ok) return true;
    } catch { /* chưa lên */ }
    await sleep(300);
  }
  return false;
}

async function main() {
  checkConflictMarkers();

  const chrome = findChrome();
  if (!chrome) {
    console.warn('⚠  Không tìm thấy Chrome (đặt CHROME_PATH) — bỏ qua phần kiểm render, chỉ kiểm bundle.');
    return;
  }

  const preview = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], {
    stdio: 'ignore', shell: process.platform === 'win32',
  });

  try {
    if (!await waitForServer()) return fail(`vite preview không lên ở ${URL}`);

    // --dump-dom in ra DOM SAU khi JS chạy → đủ để biết React đã mount hay chưa.
    const out = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--virtual-time-budget=10000', '--enable-logging=stderr', '--log-level=0',
      '--dump-dom', URL,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    const dom = out.stdout || '';
    const stderr = out.stderr || '';

    const marker = '<div id="root">';
    const at = dom.indexOf(marker);
    const rootHtml = at >= 0 ? dom.slice(at + marker.length).trimStart() : '';
    if (at < 0 || rootHtml.startsWith('</div>') || rootHtml.length < 50 || !rootHtml.includes('<')) {
      fail('#root RỖNG sau khi bundle chạy — app trắng trang. Xem log dưới đây:\n'
        + stderr.split('\n').filter((l) => /ERROR|SEVERE|Uncaught/.test(l)).slice(0, 10).join('\n'));
    } else {
      console.log('✅ #root đã render nội dung.');
    }

    const exceptions = stderr.split('\n').filter((l) => /Uncaught|SyntaxError|is not a function|has already been declared/.test(l));
    if (exceptions.length) {
      fail(`Bundle ném exception khi khởi động:\n${exceptions.slice(0, 10).join('\n')}`);
    } else {
      console.log('✅ Không có exception khi khởi động bundle.');
    }
  } finally {
    preview.kill();
  }
}

main().catch((err) => fail(err.message));
