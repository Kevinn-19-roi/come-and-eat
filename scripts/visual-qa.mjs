import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3210';
const output = path.resolve('artifacts/visual-qa');
const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
];
const routes = [
  { name: 'accueil', url: '/' },
  { name: 'restaurants', url: '/restaurants' },
  { name: 'connexion', url: '/login' },
  { name: 'inscription', url: '/signup' },
  { name: 'admin-connexion', url: '/admin/login' },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { baseUrl, generatedAt: new Date().toISOString(), checks: [], limitations: [] };

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'fr-FR' });
  for (const route of routes) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      const text = message.text();
      if (message.type() === 'error' && !text.includes('/_next/hmr')) errors.push(`console: ${text}`);
    });
    const response = await page.goto(`${baseUrl}${route.url}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('body').waitFor({ state: 'visible' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const title = await page.title();
    const screenshot = `${route.name}-${viewport.name}.png`;
    await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
    report.checks.push({ route: route.url, viewport: viewport.name, status: response?.status() ?? 0, title, overflow, errors, screenshot });
    if (!response?.ok() || overflow || errors.length) {
      throw new Error(`${route.url} @ ${viewport.name}: status=${response?.status()} overflow=${overflow} errors=${errors.join(' | ')}`);
    }
    await page.close();
  }
  await context.close();
}

const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR' });
const page = await context.newPage();
await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
const phoneLinks = await page.locator('a[href^="tel:"]').count();
const whatsappLinks = await page.locator('a[href^="https://wa.me/"]').count();
report.checks.push({ route: '/', viewport: '375', phoneLinks, whatsappLinks, feature: 'coordonnees-publiques' });
await page.goto(`${baseUrl}/restaurants`, { waitUntil: 'domcontentloaded' });
const restaurantHref = await page.locator('a[href^="/restaurants/"]').first().getAttribute('href').catch(() => null);
if (restaurantHref) {
  await page.goto(`${baseUrl}${restaurantHref}`, { waitUntil: 'domcontentloaded' });
  const contactActions = await page.locator('a[href^="tel:"],a[href^="mailto:"],a[href^="https://wa.me/"]').count();
  await page.screenshot({ path: path.join(output, 'restaurant-public-375.png'), fullPage: true });
  report.checks.push({ route: restaurantHref, viewport: '375', contactActions, screenshot: 'restaurant-public-375.png' });
} else {
  report.limitations.push('Aucun restaurant public disponible : les contacts vendeurs n’ont pas pu être vérifiés visuellement sur une fiche réelle.');
}
report.limitations.push('Les pages admin et vendeur protégées ont été vérifiées jusqu’aux écrans de connexion. Aucun compte réel ni donnée distante n’a été utilisé ou modifié.');
await context.close();
await browser.close();
await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Visual QA passed: ${report.checks.length} checks. Screenshots: ${output}`);
