#!/usr/bin/env node
/**
 * Comprehensive gh-dashboard audit.
 * Visits every route, clicks interactively, runs a11y checks,
 * captures console errors, screenshots, and reports findings.
 *
 * Usage: node tools/audit.mjs
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:5173';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];
const OUTPUT = resolve('tools/audit-output');

const ROUTES = [
  { path: '/', name: 'Overview' },
  { path: '/repositories', name: 'Repositories' },
  { path: '/insights', name: 'Insights' },
  { path: '/digest', name: 'Digest' },
  { path: '/pull-requests', name: 'Pull Requests' },
  { path: '/actions', name: 'Actions' },
  { path: '/issues', name: 'Issues' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/settings', name: 'Settings' },
  { path: '/security', name: 'Security' },
  { path: '/ci-health', name: 'CI Health' },
  { path: '/review-queue', name: 'Review Queue' },
  { path: '/kanban', name: 'Kanban' },
];

// ── Result store ────────────────────────────────────────────────────────

const findings = [];

function record(name, vp, cat, sev, msg, detail = null) {
  findings.push({ name, viewport: vp, category: cat, severity: sev, message: msg, detail });
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function stable(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch { /* api may 422 */ }
  await page.waitForTimeout(1000); // suspense/lazy settle
}

// ── Checks per page ─────────────────────────────────────────────────────

async function interactiveChecks(page, route, vp) {
  // Filter pills
  const pills = page.locator('button').filter({ has: page.locator('text=/All|Needs Attention|Awaiting Review|Assigned|Mentioned|Stale|My PRs|Draft|Merged|Needs review/i') });
  const n = await pills.count();
  if (n > 0) {
    for (let i = 0; i < Math.min(n, 3); i++) {
      try { await pills.nth(i).click(); await page.waitForTimeout(300); }
      catch (e) { record(route, vp, 'interaction', 'error', `Filter #${i} click failed: ${e.message.slice(0,120)}`); }
    }
  }

  // Export buttons
  const ex = page.locator('button, a').filter({ hasText: /export/i });
  if (await ex.count() > 0) record(route, vp, 'interaction', 'info', `Export button(s) found`);

  // Mark read
  const mr = page.locator('button').filter({ hasText: /mark.*read/i });
  if (await mr.count() > 0) record(route, vp, 'interaction', 'info', 'Mark read button(s) present');
  const ma = page.locator('button').filter({ hasText: /Mark all read/i });
  if (await ma.count() > 0 && await ma.isEnabled()) {
    try { await ma.click(); await page.waitForTimeout(300); } catch {}
  }

  // Clickable list items (notifications triage)
  const li = page.locator('[role="button"][tabindex="0"], .cursor-pointer');
  if (route === 'Notifications' && await li.count() > 0) {
    try {
      await li.first().click(); await page.waitForTimeout(500);
      if (await page.locator('.triage-panel').count() > 0) {
        record(route, vp, 'interaction', 'info', 'Triage panel opened successfully');
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      }
    } catch (e) { record(route, vp, 'interaction', 'error', `List click failed: ${e.message.slice(0,120)}`); }
  }

  // Keyboard shortcuts on Notifications
  if (route === 'Notifications') {
    await page.keyboard.press('?'); await page.waitForTimeout(500);
    if (await page.locator('[role="dialog"]').count() > 0) {
      record(route, vp, 'keyboard', 'info', '? opened help dialog');
      await page.keyboard.press('Escape');
    } else {
      record(route, vp, 'keyboard', 'warning', '? did not open help dialog');
    }
    await page.keyboard.press('j'); await page.waitForTimeout(150);
    await page.keyboard.press('j'); await page.waitForTimeout(150);
    await page.keyboard.press('k'); await page.waitForTimeout(150);
    record(route, vp, 'keyboard', 'info', 'j/k pressed');
  }

  // Theme toggle in sidebar
  const tt = page.locator('button').filter({ hasText: /theme|dark|light/i });
  if (await tt.count() > 0) record(route, vp, 'interaction', 'info', 'Theme toggle found');
}

async function visualChecks(page, route, vp) {
  // Horizontal overflow
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
  );
  if (overflow) record(route, vp, 'visual', 'error', 'Horizontal scroll — layout overflow');

  // Empty state
  const es = page.locator('text=/No items|No matching|All caught up|No repositories/i');
  if (await es.count() > 0) record(route, vp, 'visual', 'info', 'Empty state rendered');

  // Sidebar
  if (await page.locator('nav, [class*="sidebar"], [class*="Sidebar"]').count() === 0)
    record(route, vp, 'visual', 'warning', 'No sidebar/nav element');
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0,200)); });
      page.on('pageerror', err => errors.push(`Uncaught: ${err.message.slice(0,200)}`));

      const label = `${route.name} (${vp.name})`;
      process.stdout.write(`  ${label}`);

      try {
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'commit', timeout: 15000 });
        await stable(page);
      } catch (e) {
        record(route.name, vp.name, 'navigation', 'error', `Load failed: ${e.message.slice(0,150)}`);
        await page.close(); process.stdout.write(' ❌\n'); continue;
      }

      // Console
      if (errors.length) record(route.name, vp.name, 'console', 'error', `${errors.length} error(s)`, errors);

      // Screenshot
      try { await page.screenshot({ path: resolve(OUTPUT, `${route.name.replace(/\s/g,'-')}-${vp.name}.png`), fullPage: true }); } catch {}

      // Accessibility (axe-core)
      try {
        const a11y = await new AxeBuilder({ page }).analyze();
        if (a11y.violations.length) {
          record(route.name, vp.name, 'a11y', 'error', `${a11y.violations.length} violation(s)`,
            a11y.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, elements: v.nodes.length })));
        } else {
          record(route.name, vp.name, 'a11y', 'info', 'Clean');
        }
      } catch (e) {
        record(route.name, vp.name, 'a11y', 'warning', `Axe failed: ${e.message.slice(0,120)}`);
      }

      // Interaction + visual
      await interactiveChecks(page, route.name, vp.name);
      await visualChecks(page, route.name, vp.name);

      await page.close();
      process.stdout.write(' ✓\n');
    }
  }

  await browser.close();

  // ── Report ───────────────────────────────────────────────────────────

  const report = {
    ts: new Date().toISOString(),
    summary: {
      total: findings.length,
      errors: findings.filter(f => f.severity === 'error').length,
      warnings: findings.filter(f => f.severity === 'warning').length,
      info: findings.filter(f => f.severity === 'info').length,
    },
    findings,
  };
  writeFileSync(resolve(OUTPUT, 'audit-report.json'), JSON.stringify(report, null, 2));

  // Console output
  const errs = findings.filter(f => f.severity === 'error');
  const warns = findings.filter(f => f.severity === 'warning');
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Audit complete — ${findings.length} checks`);
  console.log(`  Errors:   ${errs.length}`);
  console.log(`  Warnings: ${warns.length}`);
  console.log(`  Info:     ${report.summary.info}`);
  console.log('═══════════════════════════════════════════\n');

  for (const f of [...errs, ...warns]) {
    const icon = f.severity === 'error' ? '🚨' : '⚠️ ';
    console.log(`  ${icon} [${f.category}] ${f.name} @ ${f.viewport}`);
    console.log(`     ${f.message}`);
    if (f.detail) {
      const d = typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail).slice(0,200);
      console.log(`     ${d}`);
    }
    console.log('');
  }

  console.log(`  Full report: ${OUTPUT}/audit-report.json`);
  console.log(`  Screenshots: ${OUTPUT}/\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
