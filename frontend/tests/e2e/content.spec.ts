// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/tests/e2e/content.spec.ts
// DESCRIPTION  : Génération de contenu — form, platform, brief, polling
// ============================================================

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture & helpers
// ---------------------------------------------------------------------------
const FIXTURE = {
  email:    "test@brandpilot.test",
  password: "Test1234!",
};

const FAKE_TASK_ID = "test-task-abc123";
const MOCK_RESULT = {
  task_id: FAKE_TASK_ID,
  status:  "done",
  result:  {
    text:        "Découvrez notre nouvelle collection printemps ! 🌸 Tendances, couleurs et styles qui font vibrer la saison. Rejoignez-nous pour une expérience mode unique.",
    hashtags:    ["mode", "printemps", "nouveaute", "collection", "tendance"],
    platform:    "instagram",
    tokens_used: 120,
    cost_usd:    0.002,
  },
};

async function login(page: Page, baseURL: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(FIXTURE.email);
  await page.getByLabel(/mot de passe/i).fill(FIXTURE.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// CI mocks — intercept generate + status endpoints
// Returns the mock route handlers so they can be awaited/removed if needed
// ---------------------------------------------------------------------------
async function setupCIMocks(page: Page) {
  // Mock POST /api/v1/content/text/generate → return a fake task_id
  await page.route("**/api/v1/content/text/generate", (route) => {
    void route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify({ task_id: FAKE_TASK_ID }),
    });
  });

  // Mock GET /api/v1/content/status/:id → return "done" immediately
  await page.route(`**/api/v1/content/status/${FAKE_TASK_ID}`, (route) => {
    void route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify(MOCK_RESULT),
    });
  });

  // Also handle the older text/status path if the app uses it
  await page.route(`**/api/v1/content/text/status/${FAKE_TASK_ID}`, (route) => {
    void route.fulfill({
      status:      200,
      contentType: "application/json",
      body:        JSON.stringify(MOCK_RESULT),
    });
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe("Génération de contenu", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ page, baseURL }) => {
    // Always set up API mocks (in non-CI they still work as overrides)
    await setupCIMocks(page);
    await login(page, baseURL ?? "http://localhost:3000");
  });

  test("génère un post Instagram à partir d'un brief et affiche les hashtags", async ({
    page,
  }) => {
    // ── 1. Navigate to /content/new ────────────────────────────────────────
    await page.goto("/content/new");
    await expect(
      page.getByRole("heading", { name: /générer du contenu/i }),
    ).toBeVisible();

    // ── 2. Select Instagram platform ───────────────────────────────────────
    // Platform buttons are rendered as buttons or tabs — click by label
    await page.getByRole("button", { name: /instagram/i }).first().click();

    // ── 3. Fill brief (> 20 chars) ─────────────────────────────────────────
    const briefInput = page.getByLabel(/brief|de quoi/i).or(
      page.locator("textarea").first(),
    );
    await briefInput.fill(
      "Notre nouvelle collection printemps vient de sortir avec des couleurs éclatantes.",
    );

    // ── 4. Click "Générer" ─────────────────────────────────────────────────
    await page.getByRole("button", { name: /✨\s*générer|générer/i }).click();

    // ── 5. Wait for .content-result to be visible (timeout 30s) ───────────
    const resultSection = page.locator("[data-testid='content-result']");
    await expect(resultSection).toBeVisible({ timeout: 30_000 });

    // ── 6. Verify hashtags are present in the result ───────────────────────
    // Hashtag buttons / chips should contain # tags
    const hashtagChips = resultSection.locator("button").filter({
      hasText: /^#?[a-z]/i,
    });
    // At least one hashtag chip visible
    await expect(hashtagChips.first()).toBeVisible({ timeout: 5_000 });

    // Or the raw text contains a # somewhere in the result
    const resultText = await resultSection.textContent();
    expect(resultText).toContain("#");
  });

  test("le bouton Générer est désactivé si le brief est vide", async ({ page }) => {
    await page.goto("/content/new");

    // Select a platform first
    await page.getByRole("button", { name: /instagram/i }).first().click();

    const generateBtn = page.getByRole("button", { name: /générer/i }).last();
    // Brief is empty → button should be disabled
    await expect(generateBtn).toBeDisabled();
  });
});
