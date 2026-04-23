const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const DEFAULTS = {
  base: 'http://127.0.0.1:8080',
  appId: '414478124',
  version: '8.0.68',
  output: '/root/ipatool/tmp/mobile-download-regression-result.json',
  screenshotDir: '/root/ipatool/tmp/mobile-download-regression',
  browserURL: 'http://127.0.0.1:9222',
  sessionDb: '/root/ipatool/data/ipa-webtool.db',
  timeoutMs: 8 * 60 * 1000,
};

function parseArgs(argv = []) {
  const cfg = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--base' && next) cfg.base = next, i += 1;
    else if (arg === '--app-id' && next) cfg.appId = next, i += 1;
    else if (arg === '--version' && next) cfg.version = next, i += 1;
    else if (arg === '--output' && next) cfg.output = next, i += 1;
    else if (arg === '--screenshot-dir' && next) cfg.screenshotDir = next, i += 1;
    else if (arg === '--browser-url' && next) cfg.browserURL = next, i += 1;
    else if (arg === '--session-db' && next) cfg.sessionDb = next, i += 1;
    else if (arg === '--timeout-ms' && next) cfg.timeoutMs = Number(next), i += 1;
    else if (arg === '--help') cfg.help = true;
  }
  return cfg;
}

function printHelp() {
  console.log(`Usage: node scripts/mobile-download-regression.cjs [options]\n\nOptions:\n  --app-id <id>           App Store app id (default: ${DEFAULTS.appId})\n  --version <ver>         Target version (default: ${DEFAULTS.version})\n  --base <url>            Base URL (default: ${DEFAULTS.base})\n  --output <path>         JSON output path\n  --screenshot-dir <dir>  Screenshot output directory\n  --browser-url <url>     Remote Chrome debugging URL\n  --session-db <path>     SQLite db containing admin sessions\n  --timeout-ms <ms>       Poll timeout in milliseconds\n  --help                  Show this help\n`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getAdminToken(sessionDb) {
  const py = `import sqlite3\ncon=sqlite3.connect(${JSON.stringify(sessionDb)})\ncur=con.cursor()\nrow=cur.execute("SELECT token FROM sessions WHERE username='admin' ORDER BY created_at DESC LIMIT 1").fetchone()\nprint(row[0] if row else '')`;
  return execFileSync('python', ['-c', py], { encoding: 'utf8' }).trim();
}

function extractJobIdFromRequests(requests) {
  for (let i = requests.length - 1; i >= 0; i -= 1) {
    const r = requests[i];
    if (!/\/api\/start-download-direct/.test(r.url || '')) continue;
    const m = (r.body || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (m) return m[0];
  }
  return null;
}

function extractDetailProgressState(sample = {}) {
  const buttons = Array.isArray(sample.buttons) ? sample.buttons.filter(Boolean) : [];
  const buttonLabel = buttons.find(text => /(?:获取下载信息|开始下载|下载中|安装中)\s*\d+%/.test(text)) || '';
  const body = String(sample.body || '');
  const fallback = (body.match(/(?:获取下载信息|开始下载|下载中|安装中)\s*\d+%/) || [])[0] || '';
  const label = buttonLabel || fallback || '';
  const percentMatch = label.match(/(\d+)%/);
  return {
    label,
    percent: percentMatch ? Number(percentMatch[1]) : null,
  };
}

function hasDetailProgressAdvanced(samples = []) {
  const percents = samples
    .map(sample => Number(sample?.detail?.percent))
    .filter(value => Number.isFinite(value));
  return percents.some(value => value > 0);
}

function normalizeRecordSignature(record = {}) {
  const inspection = record?.inspection || {};
  const presentCount = Array.isArray(inspection.presentSinfPaths) ? inspection.presentSinfPaths.length : null;
  const missingCount = Array.isArray(inspection.missingSinfPaths) ? inspection.missingSinfPaths.length : null;
  return JSON.stringify({
    id: record?.id ?? null,
    jobId: record?.jobId ?? null,
    appId: record?.appId ?? null,
    version: record?.version ?? null,
    packageKind: record?.packageKind ?? null,
    otaInstallable: record?.otaInstallable ?? null,
    installMethod: record?.installMethod ?? null,
    presentCount,
    missingCount,
    status: record?.status ?? null,
    progress: record?.progress ?? null,
  });
}

function matchesTaskDirFragment(record = {}, expectedTaskDirFragment = '') {
  if (!expectedTaskDirFragment) return false;
  const filePath = String(record?.filePath || '');
  const downloadUrl = String(record?.downloadUrl || '');
  return filePath.includes(expectedTaskDirFragment) || downloadUrl.includes(expectedTaskDirFragment);
}

function matchesLooseVersion(record = {}, version = '') {
  if (!version) return false;
  const haystacks = [record?.appName, record?.filePath, record?.bundleId, record?.downloadUrl]
    .map(v => String(v || ''));
  return haystacks.some(text => text.includes(version));
}

function pickTargetRecord(records = [], { jobId, appId, version, expectedTaskDirFragment } = {}) {
  if (!Array.isArray(records) || records.length === 0) return null;
  return records.find(record => jobId && String(record?.jobId || '') === String(jobId))
    || records.find(record => String(record?.appId || '') === String(appId || '') && String(record?.version || '') === String(version || ''))
    || records.find(record => matchesTaskDirFragment(record, expectedTaskDirFragment))
    || records.find(record => String(record?.appId || '') === String(appId || '') && matchesLooseVersion(record, version))
    || records.find(record => matchesLooseVersion(record, version))
    || null;
}

function getStableFinalRecord(samples = [], { jobId, appId, version, stableHitsRequired = 2, expectedTaskDirFragment } = {}) {
  let lastSignature = null;
  let stableHits = 0;
  let record = null;

  for (const sample of samples) {
    const candidates = Array.isArray(sample?.recordsList) && sample.recordsList.length
      ? sample.recordsList
      : [sample?.recordsTarget || sample?.recordsTop || sample?.topRecord].filter(Boolean);
    if (!candidates.length) continue;
    const matched = pickTargetRecord(candidates, {
      jobId: sample?.jobId || jobId,
      appId,
      version,
      expectedTaskDirFragment,
    });
    if (!matched) continue;
    record = matched;
    const signature = normalizeRecordSignature(matched);
    if (signature === lastSignature) {
      stableHits += 1;
    } else {
      lastSignature = signature;
      stableHits = 1;
    }
    if (stableHits >= stableHitsRequired) {
      return { stable: true, stableHits, record };
    }
  }

  return { stable: false, stableHits, record };
}

async function screenshot(page, screenshotDir, name) {
  const file = path.join(screenshotDir, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function runRegression(config) {
  ensureDir(path.dirname(config.output));
  ensureDir(config.screenshotDir);

  const token = getAdminToken(config.sessionDb);
  if (!token) throw new Error('No admin session token');

  const browser = await puppeteer.connect({ browserURL: config.browserURL, defaultViewport: null });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  const host = new URL(config.base).hostname;
  await page.setCookie({
    name: 'ipa_admin_session', value: token, url: config.base, domain: host, path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  });

  const consoleLogs = [];
  const requests = [];
  const screenshots = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[pageerror] ${err.stack || err.message}`));
  page.on('response', async (res) => {
    const url = res.url();
    if (/\/api\/(start-download-direct|progress-sse|job-info|download-records)/.test(url)) {
      let body = '';
      try { body = await res.text(); } catch {}
      requests.push({ type: 'response', url, status: res.status(), body: body.slice(0, 4000) });
    }
  });

  try {
    await page.goto(config.base, { waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(1500);
    screenshots.push(await screenshot(page, config.screenshotDir, '01-home.png'));

    let auth = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return { ok: r.ok, body: await r.text() };
    });
    if (!auth.ok) {
      await page.setCookie({
        name: 'ipa_admin_session', value: token, url: config.base, domain: host, path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 120000 });
      await sleep(1200);
      auth = await page.evaluate(async () => {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        return { ok: r.ok, body: await r.text() };
      });
    }
    if (!auth.ok) {
      throw new Error(`admin auth not established in browser: ${auth.body}`);
    }

    const existingRecords = await page.evaluate(async () => {
      const r = await fetch('/api/download-records', { credentials: 'include' });
      return await r.json();
    });
    const existingTop = existingRecords?.data?.[0] || null;
    const existingSameVersion = Array.isArray(existingRecords?.data)
      ? existingRecords.data.find(record => String(record?.appId || '') === String(config.appId) && String(record?.version || '') === String(config.version))
      : null;
    if (existingSameVersion) {
      throw new Error(`target version already downloaded: ${config.appId}@${config.version}; choose a fresh version for runtime verification`);
    }

    const searchInput = await page.$('input');
    if (!searchInput) throw new Error('search input not found');
    await searchInput.click({ clickCount: 3 });
    await searchInput.type(config.appId, { delay: 30 });
    await sleep(1800);
    screenshots.push(await screenshot(page, config.screenshotDir, '02-search.png'));

    const clickedConfirm = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /确认并继续/.test(b.innerText || ''));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clickedConfirm) throw new Error('confirm-and-continue button not found');

    await page.waitForFunction(() => !!document.querySelector('.version-picker__version-list'), { timeout: 30000 });
    await sleep(800);
    screenshots.push(await screenshot(page, config.screenshotDir, '03-versions.png'));

    const selectedVersion = await page.evaluate(async (version) => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const list = document.querySelector('.version-picker__version-list');
      if (!list) return { ok: false, reason: 'version list not found' };
      for (let i = 0; i < 80; i += 1) {
        const items = [...list.querySelectorAll('.version-radio-item')];
        const exact = items.find(el => (el.querySelector('.version-radio-item__ver')?.textContent || '').trim() === version);
        if (exact) {
          exact.click();
          return { ok: true, mode: 'exact', text: exact.innerText, scrollTop: list.scrollTop, index: items.indexOf(exact) };
        }
        const candidate = items.find(el => (el.innerText || '').includes(version));
        if (candidate) {
          candidate.click();
          return { ok: true, mode: 'contains', text: candidate.innerText.slice(0, 200), scrollTop: list.scrollTop, index: items.indexOf(candidate) };
        }
        const prev = list.scrollTop;
        list.scrollTop += Math.max(220, Math.floor(list.clientHeight * 0.8));
        await sleep(60);
        if (list.scrollTop === prev) break;
      }
      return { ok: false, reason: 'version not visible after scrolling' };
    }, config.version);
    if (!selectedVersion.ok) throw new Error(`version ${config.version} not found: ${JSON.stringify(selectedVersion)}`);

    await sleep(1200);
    screenshots.push(await screenshot(page, config.screenshotDir, '04-version-selected.png'));

    const clickedDownload = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const preferred = btns.find(el => /^安装$/.test((el.innerText || '').trim()))
        || btns.find(el => /下载并安装|开始下载/.test(el.innerText || ''))
        || btns.find(el => /^下载$/.test((el.innerText || '').trim()));
      if (preferred) {
        const before = preferred.innerText;
        preferred.click();
        return { ok: true, text: before };
      }
      return { ok: false, buttons: btns.map(b => b.innerText.trim()).filter(Boolean) };
    });
    if (!clickedDownload.ok) throw new Error(`download button not found: ${JSON.stringify(clickedDownload.buttons)}`);

    await sleep(1500);
    screenshots.push(await screenshot(page, config.screenshotDir, '05-after-click.png'));

    const samples = [];
    let jobId = extractJobIdFromRequests(requests);
    let reached100 = false;
    let switchedCompleted = false;
    let detailShowedProgress = false;
    let queueShowedProgress = false;
    let sawNewJob = false;

    const started = Date.now();
    while (Date.now() - started < config.timeoutMs) {
      if (!jobId) jobId = extractJobIdFromRequests(requests);

      const homeSample = await page.evaluate(async (jobIdArg) => {
        const body = document.body.innerText;
        const buttons = [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean);
        const activeTexts = body.match(/活跃\s*\([^\n]+\)|\d+%|下载已完成|任务已就绪|可手动下载或安装|正在下载|下载中/g) || [];
        let jobInfo = null;
        let records = null;
        const maybeJobId = jobIdArg || body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || null;
        if (maybeJobId) {
          try {
            const r = await fetch(`/api/job-info?jobId=${encodeURIComponent(maybeJobId)}`, { credentials: 'include' });
            jobInfo = { status: r.status, body: await r.json() };
          } catch (e) {
            jobInfo = { error: e.message };
          }
        }
        try {
          const r2 = await fetch('/api/download-records', { credentials: 'include' });
          records = await r2.json();
        } catch (e) {
          records = { error: e.message };
        }
        return { body, buttons, activeTexts, currentUrl: location.href, maybeJobId, jobInfo, records };
      }, jobId);

      await page.evaluate(() => {
        const queueBtn = [...document.querySelectorAll('button')].find(b => /^队列$/.test((b.innerText || '').trim()));
        if (queueBtn) queueBtn.click();
      });
      await sleep(500);

      const queueSample = await page.evaluate(async (jobIdArg) => {
        const body = document.body.innerText;
        const buttons = [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean);
        const activeTexts = body.match(/活跃\s*\([^\n]+\)|\d+%|下载已完成|任务已就绪|可手动下载或安装|正在下载|下载中/g) || [];
        let jobInfo = null;
        const maybeJobId = jobIdArg || body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || null;
        if (maybeJobId) {
          try {
            const r = await fetch(`/api/job-info?jobId=${encodeURIComponent(maybeJobId)}`, { credentials: 'include' });
            jobInfo = { status: r.status, body: await r.json() };
          } catch (e) {
            jobInfo = { error: e.message };
          }
        }
        return { body, buttons, activeTexts, currentUrl: location.href, maybeJobId, jobInfo };
      }, jobId);

      await page.evaluate(() => {
        const homeBtn = [...document.querySelectorAll('button')].find(b => /首页/.test((b.innerText || '').trim()));
        if (homeBtn) homeBtn.click();
      });
      await sleep(500);

      const recordsList = Array.isArray(homeSample.records?.data) ? homeSample.records.data : [];
      const top = recordsList[0] || null;
      if (!jobId) jobId = homeSample.maybeJobId || queueSample.maybeJobId || extractJobIdFromRequests(requests);
      if (!jobId && top?.jobId) jobId = top.jobId;
      if (homeSample.jobInfo?.body?.data?.jobId) jobId = homeSample.jobInfo.body.data.jobId;
      if (queueSample.jobInfo?.body?.data?.jobId) jobId = queueSample.jobInfo.body.data.jobId;
      const targetRecord = pickTargetRecord(recordsList, { jobId, appId: config.appId, version: config.version });

      const detail = extractDetailProgressState(homeSample);
      if (targetRecord && (!existingTop || targetRecord.jobId !== existingTop.jobId || targetRecord.createdAt !== existingTop.createdAt)) sawNewJob = true;
      if (detail.label) detailShowedProgress = true;
      if (/\d+%/.test(queueSample.body)) queueShowedProgress = true;
      if ((detail.percent != null && detail.percent >= 100) || /100%/.test(queueSample.body) || targetRecord?.progress === 100) reached100 = true;
      if (reached100 && (/下载已完成|任务已就绪|可手动下载或安装/.test(homeSample.body) || /下载已完成|任务已就绪|可手动下载或安装/.test(queueSample.body) || targetRecord?.status === 'completed')) switchedCompleted = true;

      samples.push({
        detail,
        at: new Date().toISOString(),
        jobId,
        topRecord: top,
        recordsTop: top,
        recordsTarget: targetRecord,
        recordsList,
        home: {
          bodyPreview: homeSample.body.slice(0, 1800),
          buttons: homeSample.buttons.slice(0, 20),
          activeTexts: homeSample.activeTexts,
          currentUrl: homeSample.currentUrl,
          maybeJobId: homeSample.maybeJobId,
          jobInfo: homeSample.jobInfo?.body?.data || homeSample.jobInfo || null
        },
        queue: {
          bodyPreview: queueSample.body.slice(0, 1800),
          buttons: queueSample.buttons.slice(0, 20),
          activeTexts: queueSample.activeTexts,
          currentUrl: queueSample.currentUrl,
          maybeJobId: queueSample.maybeJobId,
          jobInfo: queueSample.jobInfo?.body?.data || queueSample.jobInfo || null
        }
      });

      if (samples.length % 3 === 0) screenshots.push(await screenshot(page, config.screenshotDir, `progress-${samples.length}.png`));

      const stableFinal = getStableFinalRecord(samples, { jobId, appId: config.appId, version: config.version, stableHitsRequired: 2, expectedTaskDirFragment: `-${config.appId}-${config.version}` });
      if (stableFinal.stable && stableFinal.record?.status === 'completed' && Number(stableFinal.record?.progress) === 100 && sawNewJob) {
        await page.evaluate(() => {
          const queueBtn = [...document.querySelectorAll('button')].find(b => /^队列$/.test((b.innerText || '').trim()));
          if (queueBtn) queueBtn.click();
        });
        await sleep(1200);
        const finalQueueBody = await page.evaluate(() => document.body.innerText);
        await page.evaluate(() => {
          const homeBtn = [...document.querySelectorAll('button')].find(b => /首页/.test((b.innerText || '').trim()));
          if (homeBtn) homeBtn.click();
        });
        await sleep(1200);
        const finalHomeBody = await page.evaluate(() => document.body.innerText);
        samples.push({ at: new Date().toISOString(), finalHomeBodyPreview: finalHomeBody.slice(0, 2500), finalQueueBodyPreview: finalQueueBody.slice(0, 2500), jobId, topRecord: top, recordsTop: top, recordsTarget: stableFinal.record, stableFinal });
        break;
      }

      await sleep(1500);
    }

    screenshots.push(await screenshot(page, config.screenshotDir, 'final.png'));

    const stableFinal = getStableFinalRecord(samples, { jobId, appId: config.appId, version: config.version, stableHitsRequired: 2, expectedTaskDirFragment: `-${config.appId}-${config.version}` });
    const summary = {
      config,
      auth,
      existingTop,
      clickedConfirm,
      selectedVersion,
      clickedDownload,
      jobId,
      sawNewJob,
      reached100,
      switchedCompleted,
      detailShowedProgress,
      detailProgressAdvanced: hasDetailProgressAdvanced(samples),
      queueShowedProgress,
      stableFinalRecord: stableFinal.record || null,
      stableFinalReached: stableFinal.stable,
      stableFinalHits: stableFinal.stableHits,
      sampleCount: samples.length,
      lastSample: samples[samples.length - 1] || null,
      requests: requests.slice(-50),
      consoleLogs: consoleLogs.slice(-100),
      screenshots,
    };

    const payload = { summary, samples };
    fs.writeFileSync(config.output, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    await page.close();
    await browser.disconnect();
    return payload;
  } catch (err) {
    const payload = { error: err.message, stack: err.stack, config, screenshots };
    fs.writeFileSync(config.output, JSON.stringify(payload, null, 2));
    try { await page.close(); } catch {}
    try { await browser.disconnect(); } catch {}
    throw err;
  }
}

if (require.main === module) {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printHelp();
    process.exit(0);
  }
  runRegression(config).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  DEFAULTS,
  parseArgs,
  runRegression,
  extractJobIdFromRequests,
  extractDetailProgressState,
  hasDetailProgressAdvanced,
  pickTargetRecord,
  getStableFinalRecord,
};
