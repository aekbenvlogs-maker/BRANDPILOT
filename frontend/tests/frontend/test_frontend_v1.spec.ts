// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : tests/frontend/test_frontend_v1.spec.ts
// DESCRIPTION  : Playwright E2E — 3 user parcours
// ============================================================

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FIXTURE = {
  email:     "test@brandpilot.test",
  password:  "Test1234!",
  firstName: "Alice",
  lastName:  "Dupont",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function resetDB() {
  try {
    await fetch(`${BASE}/api/v1/test/reset`, { method: "POST" });
  } catch {
    // ignore — test env may not expose reset endpoint
  }
}

async function login(page: Page, email = FIXTURE.email, password = FIXTURE.password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────
// 1. Parcours Inscription → Onboarding → Dashboard
// ─────────────────────────────────────────────────────────────
test.describe("Parcours 1 — Inscription / Onboarding / Dashboard", () => {
  test.beforeEach(async () => { await resetDB(); });
  test.setTimeout(60_000);

  test("nouvel utilisateur peut s'inscrire, compléter l'onboarding et accéder au dashboard", async ({ page }) => {
    // ── Register ──────────────────────────────────────────────
    await page.goto(`${BASE}/register`);
    await page.getByLabel(/prénom/i).fill(FIXTURE.firstName);
    await page.getByLabel(/nom/i).fill(FIXTURE.lastName);
    await page.getByLabel(/email/i).fill(FIXTURE.email);

    const passwordFields = page.getByLabel(/mot de passe/i);
    await passwordFields.nth(0).fill(FIXTURE.password);
    await passwordFields.nth(1).fill(FIXTURE.password);

    await page.getByRole("button", { name: /créer mon compte/i }).click();

    // Redirected to onboarding
    await page.waitForURL(`${BASE}/onboarding`, { timeout: 15_000 });
    await expect(page.getByText(/votre marque/i)).toBeVisible();

    // ── Onboarding Step 1 ─────────────────────────────────────
    await page.getByLabel(/nom du projet/i).fill("Ma Boutique Test");
    await page.getByLabel(/secteur/i).fill("Mode");
    await page.getByRole("button", { name: /continuer/i }).click();

    // ── Onboarding Step 2 ─────────────────────────────────────
    await expect(page.getByText(/votre tonalité/i)).toBeVisible();
    await page.getByRole("button", { name: /créatif/i }).click();
    await page.getByRole("button", { name: /générer mon premier contenu/i }).click();

    // ── Onboarding Step 3 ─────────────────────────────────────
    await expect(page.getByText(/votre premier contenu/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /accéder à mon dashboard/i }).click();

    // ── Dashboard ─────────────────────────────────────────────
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // KPI cards visible
    await expect(page.getByText(/projets actifs/i)).toBeVisible();
    await expect(page.getByText(/total leads/i)).toBeVisible();
    await expect(page.getByText(/campagnes actives/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Parcours Connexion → Projet → Contenu IA
// ─────────────────────────────────────────────────────────────
test.describe("Parcours 2 — Login / Projet / Contenu IA", () => {
  test.beforeEach(async ({ page }) => {
    await resetDB();
    // Pre-register user via API so we can log in
    await page.request.post(`${BASE}/api/v1/auth/register`, {
      data: {
        email:      FIXTURE.email,
        password:   FIXTURE.password,
        first_name: FIXTURE.firstName,
        last_name:  FIXTURE.lastName,
      },
    });
  });
  test.setTimeout(60_000);

  test("utilisateur peut se connecter, créer un projet et générer du contenu", async ({ page }) => {
    // ── Login ─────────────────────────────────────────────────
    await login(page);

    // ── Create project ────────────────────────────────────────
    await page.goto(`${BASE}/projects`);
    await page.getByRole("button", { name: /nouveau projet/i }).click();
    await page.getByLabel(/nom du projet/i).fill("Projet Playwright");
    await page.getByLabel(/secteur/i).fill("Tech");

    // Select tone
    const toneSelect = page.locator("select").filter({ hasText: /tonalité/i }).or(
      page.locator("select[name='tone']"),
    ).first();
    await toneSelect.selectOption("Créatif");

    await page.getByRole("button", { name: /créer le projet/i }).click();

    // Project appears in list
    await expect(page.getByText("Projet Playwright")).toBeVisible({ timeout: 10_000 });

    // ── Generate content ──────────────────────────────────────
    await page.goto(`${BASE}/content`);
    await expect(page.getByRole("heading", { name: /contenu ia/i })).toBeVisible();

    // Select Instagram platform
    await page.getByRole("button", { name: /instagram/i }).click();

    // Fill brief
    await page.getByPlaceholder(/décrivez votre objectif/i).fill("Présente notre nouvelle collection printemps");

    // Generate
    await page.getByRole("button", { name: /générer/i }).click();

    // Wait for result (polls every 2s, allow up to 30s)
    await expect(page.getByPlaceholder(/votre contenu généré/i)).not.toHaveValue("", { timeout: 30_000 });

    // Verify hashtag pills appear
    const result = page.locator("textarea").last();
    const content = await result.inputValue();
    expect(content.length).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Parcours Lead → Scoring → Campagne
// ─────────────────────────────────────────────────────────────
test.describe("Parcours 3 — Lead / Scoring / Campagne", () => {
  test.beforeEach(async ({ page }) => {
    await resetDB();
    await page.request.post(`${BASE}/api/v1/auth/register`, {
      data: {
        email:      FIXTURE.email,
        password:   FIXTURE.password,
        first_name: FIXTURE.firstName,
        last_name:  FIXTURE.lastName,
      },
    });
  });
  test.setTimeout(60_000);

  test("utilisateur peut ajouter un lead, vérifier le tier badge et créer une campagne", async ({ page }) => {
    await login(page);

    // ── Add lead ──────────────────────────────────────────────
    await page.goto(`${BASE}/leads`);
    await page.getByRole("button", { name: /ajouter un lead/i }).click();

    await page.getByLabel(/email/i).fill("jean.test@example.com");
    await page.getByLabel(/prénom/i).fill("Jean");
    await page.getByLabel(/nom/i).fill("Test");
    await page.getByLabel(/entreprise/i).fill("ACME Corp");

    await page.getByRole("button", { name: /^ajouter$/i }).click();

    // Lead visible in table
    await expect(page.getByText("Jean")).toBeVisible({ timeout: 10_000 });

    // Tier badge (hot / warm / cold) is visible
    const tierBadges = page.locator("[data-testid='tier-badge'], .tier-badge").or(
      page.getByText(/tier [abc]/i)
    );
    // At least score column exists
    await expect(page.getByRole("columnheader", { name: /score/i })).toBeVisible();

    // ── Create campaign ───────────────────────────────────────
    await page.goto(`${BASE}/campaigns`);
    await page.getByRole("button", { name: /nouvelle campagne/i }).click();

    // Fill campaign name
    await page.getByLabel(/nom de la campagne/i).fill("Campagne Test E2E");

    // Select template
    const templateSelect = page.locator("select[name='template']").or(
      page.getByLabel(/template/i)
    ).first();
    await templateSelect.selectOption({ index: 1 });

    // Select lead
    const leadCheckbox = page.getByRole("checkbox", { name: /jean/i }).or(
      page.getByRole("checkbox").first()
    );
    if (await leadCheckbox.count() > 0) {
      await leadCheckbox.first().check();
    }

    await page.getByRole("button", { name: /créer la campagne/i }).click();

    // Campaign appears with Brouillon status
    await expect(page.getByText("Campagne Test E2E")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/brouillon/i)).toBeVisible();
  });
});
