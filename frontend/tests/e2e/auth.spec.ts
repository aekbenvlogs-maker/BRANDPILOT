// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/tests/e2e/auth.spec.ts
// DESCRIPTION  : Parcours Register → Onboarding → Dashboard
// ============================================================

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const FIXTURE = {
  // Unique email per test run so concurrent runs don't collide
  email:     `e2e-${Date.now()}@brandpilot.test`,
  password:  "Test1234!",
  firstName: "Alice",
  lastName:  "Dupont",
  brand:     "Ma Boutique E2E",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function resetTestDB(baseURL: string) {
  try {
    await fetch(`${baseURL}/api/v1/test/reset`, { method: "POST" });
  } catch {
    // Non-blocking — endpoint may not exist in all envs
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe("Parcours — Register → Onboarding → Dashboard", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ baseURL }) => {
    await resetTestDB(baseURL ?? "http://localhost:3000");
  });

  test("nouvel utilisateur s'inscrit, complète l'onboarding et voit les KPI cards", async ({
    page,
  }) => {
    // ── 1. Navigate to /register ──────────────────────────────────────────
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /créer.*compte/i })).toBeVisible();

    // ── 2. Fill form (no opt_in field on this form — submit directly) ─────
    await page.getByLabel("Prénom").fill(FIXTURE.firstName);
    await page.getByLabel("Nom").fill(FIXTURE.lastName);
    await page.getByLabel("Email").fill(FIXTURE.email);

    // Two password fields — fill by order (Password then Confirm)
    const pwdFields = page.getByLabel(/mot de passe/i);
    await pwdFields.nth(0).fill(FIXTURE.password);
    await pwdFields.nth(1).fill(FIXTURE.password);

    // ── 3. Submit → expect redirect to /onboarding ────────────────────────
    await page.getByRole("button", { name: /créer mon compte/i }).click();
    await page.waitForURL("**/onboarding", { timeout: 15_000 });
    await expect(page.getByText(/votre marque/i)).toBeVisible();

    // ── 4. Complete onboarding step 1 ─────────────────────────────────────
    await page.getByLabel(/nom de la marque/i).fill(FIXTURE.brand);

    // Sector dropdown
    const sectorSelect = page.locator("select").first();
    await sectorSelect.selectOption({ index: 1 }); // pick first real option

    await page.getByRole("button", { name: /créer mon espace/i }).click();

    // ── 4b. Step 2 — pick a tone + at least 1 platform ───────────────────
    await expect(page.getByText(/votre style/i)).toBeVisible({ timeout: 10_000 });

    // Select first tone card
    await page.getByRole("button", { name: /professionnel/i }).first().click();

    // Select first platform toggle (Instagram)
    await page.getByRole("button", { name: /instagram/i }).click();

    await page.getByRole("button", { name: /suivant/i }).click();

    // ── 4c. Step 3 — skip generation, go straight to dashboard ───────────
    await expect(page.getByText(/premier contenu/i)).toBeVisible({ timeout: 10_000 });

    // Navigate to dashboard directly (generation is optional in onboarding)
    await page.goto("/dashboard");

    // ── 5. Verify .kpi-card elements on /dashboard ─────────────────────────
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    const kpiCards = page.locator("[data-testid='kpi-card']");
    await expect(kpiCards.first()).toBeVisible({ timeout: 10_000 });
    // Expect at least 2 KPI cards rendered
    const count = await kpiCards.count();
    expect(count).toBeGreaterThan(1);
  });
});
