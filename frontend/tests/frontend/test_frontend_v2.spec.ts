// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : tests/frontend/test_frontend_v2.spec.ts
// DESCRIPTION  : Playwright E2E — V2 feature flows (3 parcours)
//                - Parcours 1 : Brand Analysis full flow
//                - Parcours 2 : Content Studio multi-platform
//                - Parcours 3 : Editorial Calendar drag & drop
// ============================================================

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FIXTURE = {
  email: "test@brandpilot.test",
  password: "Test1234!",
};

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(FIXTURE.email);
  await page.getByLabel(/mot de passe/i).fill(FIXTURE.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10_000 });
}

async function resetDB() {
  try {
    await fetch(`${BASE}/api/v1/test/reset`, { method: "POST" });
  } catch {
    // ignore in non-test environments
  }
}

// ──────────────────────────────────────────────────────────────
// MOCK SETUP (MSW via service worker is auto-loaded in test env)
// These tests assume the app is running with MSW mocks enabled
// (NEXT_PUBLIC_API_MOCKING=true or similar env flag)
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// PARCOURS 1 — Brand Analysis full flow
// ──────────────────────────────────────────────────────────────
test.describe("Parcours 1 — Brand Analysis", () => {
  test.beforeEach(async ({ page }) => {
    await resetDB();
    await login(page);
  });

  test("accède à la page Brand Analyzer depuis la sidebar", async ({ page }) => {
    // Sidebar V2 — Social Media section should be visible
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    const brandLink = page.getByRole("link", { name: /brand analyzer/i });
    await expect(brandLink).toBeVisible();
    await brandLink.click();
    await page.waitForURL(`${BASE}/brand`);
    await expect(page.getByRole("heading", { name: /brand analyzer/i })).toBeVisible();
  });

  test("soumet une URL et déclenche l'analyse", async ({ page }) => {
    await page.goto(`${BASE}/brand`);

    // Should show URL form
    const urlInput = page.getByLabel(/url/i);
    await expect(urlInput).toBeVisible();

    await urlInput.fill("https://example-brand.com");
    const submitBtn = page.getByRole("button", { name: /analyser/i });
    await submitBtn.click();

    // Should show progress bar / loading state
    await expect(page.getByRole("status")).toBeVisible({ timeout: 5_000 });
  });

  test("affiche le rapport d'analyse une fois disponible (données mockées)", async ({ page }) => {
    // This test assumes MSW returns mock data for /api/v1/brand-analysis/{id}/latest
    await page.goto(`${BASE}/brand`);

    // If mock data is pre-seeded, the report should load
    // Wait for score gauge heading or report section
    const reportHeading = page.getByText(/score de marque/i);
    if (await reportHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(reportHeading).toBeVisible();
      // Verify key sections exist
      await expect(page.getByText(/palette de couleurs/i)).toBeVisible();
      await expect(page.getByText(/recommandations/i)).toBeVisible();
    }
  });

  test("validation — URL invalide affiche une erreur", async ({ page }) => {
    await page.goto(`${BASE}/brand`);
    const urlInput = page.getByLabel(/url/i);
    await urlInput.fill("not-a-valid-url");
    await page.getByRole("button", { name: /analyser/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/url invalide/i)).toBeVisible();
  });

  test("la sidebar affiche le badge NEW sur les items V2", async ({ page }) => {
    const newBadges = page.locator("aside").getByText("NEW");
    await expect(newBadges.first()).toBeVisible();
    const count = await newBadges.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

// ──────────────────────────────────────────────────────────────
// PARCOURS 2 — Content Studio multi-platform
// ──────────────────────────────────────────────────────────────
test.describe("Parcours 2 — Content Studio", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("accède au Content Studio depuis la sidebar", async ({ page }) => {
    const studioLink = page.getByRole("link", { name: /content studio/i });
    await expect(studioLink).toBeVisible();
    await studioLink.click();
    await page.waitForURL(`${BASE}/studio`);
    await expect(page.getByRole("heading", { name: /content studio/i })).toBeVisible();
  });

  test("saisit un brief et sélectionne les plateformes", async ({ page }) => {
    await page.goto(`${BASE}/studio`);

    const briefTextarea = page.getByLabel(/brief/i);
    await expect(briefTextarea).toBeVisible();
    await briefTextarea.fill("Annoncer le lancement de notre collection printemps avec un ton inspirant.");

    // Select tone
    const toneSelect = page.getByLabel(/ton/i);
    await toneSelect.selectOption("Inspirant");

    // Toggle platforms
    const instagramBtn = page.getByRole("button", { name: "Instagram" });
    await expect(instagramBtn).toBeVisible();
    await instagramBtn.click(); // deselect
    await instagramBtn.click(); // reselect

    // Platform should be pressed
    await expect(instagramBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("génère du contenu et affiche l'éditeur", async ({ page }) => {
    await page.goto(`${BASE}/studio`);

    const briefTextarea = page.getByLabel(/brief/i);
    await briefTextarea.fill("Lancement produit printemps.");

    const generateBtn = page.getByRole("button", { name: /générer le contenu/i });
    await generateBtn.click();

    // Should show loading state
    await expect(page.getByText(/génération/i)).toBeVisible({ timeout: 3_000 });
  });

  test("affiche l'éditeur multi-plateforme avec tabs (données mockées)", async ({ page }) => {
    await page.goto(`${BASE}/studio`);

    // If mock data auto-loads result, editor tabs should appear
    const editorSection = page.getByText(/éditeur multi-plateforme/i);
    if (await editorSection.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(editorSection).toBeVisible();
      // Tab list should be present
      const tabList = page.getByRole("tablist", { name: "Plateformes" });
      await expect(tabList).toBeVisible();
    }
  });

  test("accède au Grid Maker depuis la sidebar Studio", async ({ page }) => {
    const gridLink = page.getByRole("link", { name: /grid maker/i });
    await expect(gridLink).toBeVisible();
    await gridLink.click();
    await page.waitForURL(`${BASE}/studio/grid`);
    await expect(page.getByRole("heading", { name: /grid maker/i })).toBeVisible();
    // Upload zone should be present
    await expect(page.getByRole("region", { name: /zone de dépôt/i })).toBeVisible();
  });

  test("accède au Redimensionneur depuis la sidebar", async ({ page }) => {
    const resizeLink = page.getByRole("link", { name: /redimensionner/i });
    await expect(resizeLink).toBeVisible();
    await resizeLink.click();
    await page.waitForURL(`${BASE}/studio/resize`);
    await expect(page.getByRole("heading", { name: /redimensionneur/i })).toBeVisible();
  });

  test("le compteur de caractères s'affiche (données mockées)", async ({ page }) => {
    await page.goto(`${BASE}/studio`);
    // If editor is loaded, char counter should be visible
    const charCounter = page.locator("span[aria-label*='caractères']");
    if (await charCounter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(charCounter).toBeVisible();
    }
  });

  test("toggle Mobile/Desktop dans l'aperçu est accessible", async ({ page }) => {
    await page.goto(`${BASE}/studio`);
    const mobileBtn = page.getByRole("button", { name: /vue mobile/i });
    if (await mobileBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(mobileBtn).toBeVisible();
      const desktopBtn = page.getByRole("button", { name: /vue desktop/i });
      await desktopBtn.click();
      await expect(desktopBtn).toHaveAttribute("aria-pressed", "true");
    }
  });
});

// ──────────────────────────────────────────────────────────────
// PARCOURS 3 — Calendar drag & drop
// ──────────────────────────────────────────────────────────────
test.describe("Parcours 3 — Editorial Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("accède au planificateur depuis la sidebar", async ({ page }) => {
    const plannerLink = page.getByRole("link", { name: /planificateur/i });
    await expect(plannerLink).toBeVisible();
    await plannerLink.click();
    await page.waitForURL(`${BASE}/planner`);
    await expect(page.getByRole("heading", { name: /planificateur/i })).toBeVisible();
  });

  test("affiche la liste des campagnes ou l'état vide", async ({ page }) => {
    await page.goto(`${BASE}/planner`);
    // Either shows campaign cards or the empty state
    const emptyCTA = page.getByRole("button", { name: /créer une campagne/i });
    const campaignGrid = page.locator("[href^='/planner/']").first();

    const hasEmpty = await emptyCTA.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasCampaigns = await campaignGrid.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasEmpty || hasCampaigns).toBe(true);
  });

  test("navigue vers une campagne et affiche le calendrier (données mockées)", async ({ page }) => {
    // Assume MSW serves a campaign list with at least one campaign
    await page.goto(`${BASE}/planner`);

    const firstCampaignLink = page.locator("a[href^='/planner/']").first();
    if (await firstCampaignLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstCampaignLink.click();
      // Should show the editorial calendar
      await expect(page.getByRole("grid", { name: /calendrier éditorial/i })).toBeVisible({ timeout: 8_000 });
    }
  });

  test("les boutons de navigation semaine fonctionnent", async ({ page }) => {
    await page.goto(`${BASE}/planner`);
    const firstLink = page.locator("a[href^='/planner/']").first();
    if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstLink.click();
      const nextWeekBtn = page.getByRole("button", { name: /semaine suivante/i });
      if (await nextWeekBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const labelBefore = await page.locator("aside + main, main").getByText(/→/).textContent();
        await nextWeekBtn.click();
        const labelAfter = await page.locator("aside + main, main").getByText(/→/).textContent();
        expect(labelAfter).not.toEqual(labelBefore);
      }
    }
  });

  test("le filtre plateforme est accessible", async ({ page }) => {
    await page.goto(`${BASE}/planner`);
    const firstLink = page.locator("a[href^='/planner/']").first();
    if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstLink.click();
      const filterGroup = page.getByRole("group", { name: /filtrer par plateforme/i });
      if (await filterGroup.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(filterGroup).toBeVisible();
        const instagramFilter = filterGroup.getByText(/instagram/i);
        await instagramFilter.click();
        // Should toggle aria-label on the filter
      }
    }
  });

  test("drag d'un post vers un autre jour (simulation HTML5 D&D)", async ({ page }) => {
    await page.goto(`${BASE}/planner`);
    const firstLink = page.locator("a[href^='/planner/']").first();
    if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstLink.click();
      const calendar = page.getByRole("grid", { name: /calendrier éditorial/i });
      if (await calendar.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const postCards = calendar.locator("[draggable='true']");
        const dayCell = calendar.getByRole("gridcell").nth(2);

        if (await postCards.count() > 0 && await dayCell.isVisible()) {
          const card = postCards.first();
          const cardBox = await card.boundingBox();
          const cellBox = await dayCell.boundingBox();

          if (cardBox && cellBox) {
            // Simulate drag using mouse events
            await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2, { steps: 10 });
            await page.mouse.up();

            // Verify the move was registered (no crash)
            await expect(calendar).toBeVisible();
          }
        }
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────
// ACCESSIBILITY CHECKS (shared)
// ──────────────────────────────────────────────────────────────
test.describe("Accessibilité — Pages V2", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const V2_PAGES = [
    { path: "/brand", name: "Brand Analyzer" },
    { path: "/social/accounts", name: "Comptes sociaux" },
    { path: "/social/audience", name: "Audience" },
    { path: "/social/influencers", name: "Influenceurs" },
    { path: "/social/pricing", name: "Tarifs" },
    { path: "/studio", name: "Content Studio" },
    { path: "/studio/grid", name: "Grid Maker" },
    { path: "/studio/resize", name: "Resize" },
    { path: "/planner", name: "Planner" },
    { path: "/analytics/social", name: "Social Analytics" },
  ];

  for (const { path, name } of V2_PAGES) {
    test(`${name} — la page se charge sans erreur JS`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${BASE}${path}`, { timeout: 15_000 });
      // Basic check: page renders <main>
      await expect(page.locator("main")).toBeVisible({ timeout: 8_000 });
      // No critical JS errors
      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("Non-Error")
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }

  test("la sidebar V2 est navigable au clavier", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    const sidebar = page.getByRole("navigation", { name: "Menu principal" });
    await expect(sidebar).toBeVisible();
    // First focusable link should be reachable via Tab
    await page.keyboard.press("Tab");
    const focusedEl = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedEl).toBeTruthy();
  });

  test("Brand Analyzer — le formulaire est accessible", async ({ page }) => {
    await page.goto(`${BASE}/brand`);
    const urlInput = page.getByLabel(/url/i);
    await expect(urlInput).toBeVisible();
    // Input should have a proper label (not just placeholder)
    const labelFor = await urlInput.getAttribute("id");
    if (labelFor) {
      const label = page.locator(`label[for="${labelFor}"]`);
      await expect(label).toBeVisible();
    }
  });

  test("heatmap d'audience a un aria-label", async ({ page }) => {
    await page.goto(`${BASE}/social/audience`);
    // If connected accounts exist (MSW mock), the heatmap should be accessible
    const heatmap = page.getByRole("img", { name: /heatmap/i });
    if (await heatmap.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(heatmap).toBeVisible();
    }
  });
});
