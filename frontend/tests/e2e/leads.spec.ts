// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/tests/e2e/leads.spec.ts
// DESCRIPTION  : Création lead + validation RGPD + scoring spinner
// ============================================================

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const FIXTURE = {
  email:    "test@brandpilot.test",
  password: "Test1234!",
};

// Lead to create during the test (email must be unique enough)
const TEST_LEAD = {
  email:      `e2e-lead-${Date.now()}@example.com`,
  firstName:  "Jean",
  lastName:   "Testeur",
  company:    "Acme Corp E2E",
};

// Fake project returned by the mocked /api/v1/projects endpoint
// project_id must be a valid UUID (Zod validates it in the lead form)
const FAKE_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_PROJECT    = {
  id:          FAKE_PROJECT_ID,
  name:        "Projet Test E2E",
  sector:      "mode",
  tone:        "professionnel",
  brand_url:   null,
  description: null,
  created_at:  "2024-01-01T00:00:00Z",
  updated_at:  null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function login(page: Page, baseURL: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(FIXTURE.email);
  await page.getByLabel(/mot de passe/i).fill(FIXTURE.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe("Leads — création + validation RGPD + scoring", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ page, baseURL }) => {
    // Mock GET /api/v1/projects before login so the button is never disabled
    // (activeProject = projects[0].id when there is exactly 1 project)
    await page.route("**/api/v1/projects", (route) => {
      void route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ items: [FAKE_PROJECT], total: 1 }),
      });
    });
    await login(page, baseURL ?? "http://localhost:3000");
  });

  // ── Test 1: opt_in gate ──────────────────────────────────────────────────
  test("bouton Créer est désactivé sans opt_in, activé après", async ({ page }) => {
    await page.goto("/leads");

    // Click "Ajouter un lead"
    await page.getByRole("button", { name: /ajouter un lead/i }).click();

    // Modal should appear
    await expect(
      page.getByRole("dialog", { name: /ajouter un lead/i }),
    ).toBeVisible();

    // Fill email so form is otherwise valid
    await page.getByLabel(/email/i).fill(TEST_LEAD.email);

    // Créer button should be disabled while opt_in is unchecked
    const createBtn = page.getByRole("button", { name: /^créer$/i });
    await expect(createBtn).toBeDisabled();

    // Check the opt_in checkbox (RGPD consent)
    const optInCheckbox = page.locator("input[type='checkbox']");
    await optInCheckbox.check();

    // Now the button should be enabled
    await expect(createBtn).toBeEnabled();
  });

  // ── Test 2: full creation flow + scoring spinner ─────────────────────────
  test("soumet le formulaire et le lead apparaît dans le tableau avec spinner de scoring", async ({
    page,
  }) => {
    // Mock the lead creation response so we get a known ID back
    const LEAD_ID = `lead-${Date.now()}`;

    const fakeLead = {
      id:          LEAD_ID,
      email:       TEST_LEAD.email,
      first_name:  TEST_LEAD.firstName,
      last_name:   TEST_LEAD.lastName,
      company:     TEST_LEAD.company,
      source:      null,
      opt_in:      true,
      score:       null,       // null → triggers scoring spinner immediately
      score_tier:  null,
      project_id:  FAKE_PROJECT_ID,
      created_at:  new Date().toISOString(),
    };

    // Single handler for ALL /api/v1/leads requests (with or without query params).
    // **/api/v1/leads* matches ?project_id=… (no slash), but NOT /api/v1/leads/123
    await page.route("**/api/v1/leads*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status:      201,
          contentType: "application/json",
          body:        JSON.stringify(fakeLead),
        });
      } else {
        await route.fulfill({
          status:      200,
          contentType: "application/json",
          body:        JSON.stringify({ items: [fakeLead], total: 1 }),
        });
      }
    });

    // Intercept scoring calls so they never reach the real backend
    await page.route(`**/api/v1/leads/${LEAD_ID}/rescore`, (route) => {
      void route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ task_id: `score-task-${LEAD_ID}` }),
      });
    });
    await page.route(`**/score/${LEAD_ID}`, (route) => {
      void route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ task_id: `score-task-${LEAD_ID}` }),
      });
    });

    await page.goto("/leads");

    // Open modal
    await page.getByRole("button", { name: /ajouter un lead/i }).click();
    await expect(
      page.getByRole("dialog", { name: /ajouter un lead/i }),
    ).toBeVisible();

    // Fill required fields
    await page.getByLabel("Prénom").fill(TEST_LEAD.firstName);
    await page.getByLabel("Nom").fill(TEST_LEAD.lastName);
    await page.getByLabel(/email/i).fill(TEST_LEAD.email);
    await page.getByLabel(/entreprise/i).fill(TEST_LEAD.company);

    // Accept RGPD
    await page.locator("input[type='checkbox']").check();

    // Submit
    await page.getByRole("button", { name: /^créer$/i }).click();

    // Modal should close
    await expect(
      page.getByRole("dialog", { name: /ajouter un lead/i }),
    ).not.toBeVisible({ timeout: 8_000 });

    // ── Lead appears in the table ──────────────────────────────────────────
    // The table row should show the lead email
    await expect(
      page.getByRole("cell", { name: TEST_LEAD.email }),
    ).toBeVisible({ timeout: 10_000 });

    // ── Scoring spinner is visible on the row ──────────────────────────────
    // score is null → spinner renders immediately after creation
    const spinner = page.locator("[data-testid='scoring-spinner']").first();
    await expect(spinner).toBeVisible({ timeout: 8_000 });
  });
});
