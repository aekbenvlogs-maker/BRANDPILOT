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

/** Intercept scoring endpoint so the spinner appears briefly then resolves */
async function mockScoringEndpoints(page: Page, leadId: string) {
  // Initial "processing" response
  let callCount = 0;

  await page.route(`**/score/${leadId}`, (route) => {
    void route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify({ task_id: `score-task-${leadId}` }),
    });
  });

  // Return null score first, then a real score so the spinner is visible momentarily
  await page.route(`**/api/v1/leads*`, async (route) => {
    const res = await route.fetch();
    const body = await res.json() as { items?: Array<{ id: string; score: unknown }> };
    if (body.items && callCount < 2) {
      callCount++;
      // First refetch: score still null so spinner stays
      body.items = body.items.map((l) =>
        l.id === leadId ? { ...l, score: null, score_tier: null } : l,
      );
    }
    await route.fulfill({ response: res, json: body });
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe("Leads — création + validation RGPD + scoring", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ page, baseURL }) => {
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

    await page.route("**/api/v1/leads", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status:      201,
          contentType: "application/json",
          body: JSON.stringify({
            id:          LEAD_ID,
            email:       TEST_LEAD.email,
            first_name:  TEST_LEAD.firstName,
            last_name:   TEST_LEAD.lastName,
            company:     TEST_LEAD.company,
            source:      null,
            opt_in:      true,
            score:       null,       // null → triggers scoring spinner
            score_tier:  null,
            project_id:  "proj-test",
            created_at:  new Date().toISOString(),
          }),
        });
      } else {
        // GET — return the lead in the list
        await route.fulfill({
          status:      200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id:          LEAD_ID,
                email:       TEST_LEAD.email,
                first_name:  TEST_LEAD.firstName,
                last_name:   TEST_LEAD.lastName,
                company:     TEST_LEAD.company,
                source:      null,
                opt_in:      true,
                score:       null,
                score_tier:  null,
                project_id:  "proj-test",
                created_at:  new Date().toISOString(),
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await mockScoringEndpoints(page, LEAD_ID);

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
