import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'gungun-preview.html');
const html = fs.readFileSync(FILE, 'utf8');
// Artifact のラッパを模擬（doctype+head+body で包む）
const wrapped = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;

const server = http.createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(wrapped); });
await new Promise((r) => server.listen(8077, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('EXC: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|net::/.test(m.text())) errors.push('ERR: ' + m.text()); });

await page.goto('http://localhost:8077/', { waitUntil: 'load' });
await page.waitForTimeout(3500);
const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'preview-boot.png') });
console.log('root content length:', rootHtml);
console.log('errors:', errors.slice(0, 8).join('\n') || 'none');

await browser.close();
server.close();
