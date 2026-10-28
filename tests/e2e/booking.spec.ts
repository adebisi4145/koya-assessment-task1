import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

// End-to-end: drives the real page in Chrome against the running app and API.

const API_KEY = process.env.API_KEY ?? "";

function slotAt(id: string, hoursFromNow: number, provider: string) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  return { id, provider, start: start.toISOString(), end: end.toISOString() };
}

/** A slot card in the slot list (not the doctor filter chip of the same name). */
const slotCard = (page: Page, provider: string) =>
  page.getByRole("list").getByRole("button", { name: new RegExp(provider) });

async function resetSlots(request: APIRequestContext) {
  const res = await request.post("/reset", {
    headers: { "X-API-Key": API_KEY },
    data: { slots: [slotAt("e2e-a", 26, "Dr Ade Okafor"), slotAt("e2e-b", 27, "Dr Bisi Bello")] },
  });
  expect(res.status()).toBe(200);
}

test.beforeEach(async ({ request }) => {
  await resetSlots(request);
});

test("book a slot, see the confirmation, then cancel it", async ({ page }) => {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  await page.goto("/");

  const slot = slotCard(page, "Dr Ade Okafor");
  await expect(slot).toContainText("Available");
  await slot.click();

  const name = page.getByLabel("Full name");
  await expect(name).toBeFocused();
  await name.fill("Ada Obi");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Book appointment" }).click();

  // Confirmation page
  await expect(page).toHaveURL(/\/booking\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "You're booked in." })).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  // Scoped to the details list: Next keeps the previous page mounted (hidden) for
  // instant back-navigation, so a bare getByText would also match its slot cards.
  const details = page.getByRole("definition");
  await expect(details.filter({ hasText: email })).toBeVisible();
  await expect(details.filter({ hasText: "Dr Ade Okafor" })).toBeVisible();
  const bookingUrl = page.url();

  // The slot is now taken on the home page
  await page.goto("/");
  const taken = slotCard(page, "Dr Ade Okafor");
  await expect(taken).toBeDisabled();
  await expect(taken).toContainText("Booked");

  // Cancel (two-step)
  await page.goto(bookingUrl);
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByRole("heading", { name: "This booking was cancelled." })).toBeVisible();

  // ...and it shows up under My bookings, found case-insensitively
  await page.goto("/my-bookings");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Find bookings" }).click();
  await expect(page.getByRole("link", { name: /Cancelled/ })).toHaveCount(1);

  // The slot is free again
  await page.goto("/");
  await expect(slotCard(page, "Dr Ade Okafor")).toBeEnabled();
});

test("someone else takes the slot first: friendly message and refreshed list", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await slotCard(page, "Dr Bisi Bello").click();
  await page.getByLabel("Full name").fill("Ada Obi");
  await page.getByLabel("Email").fill(`late-${randomUUID().slice(0, 8)}@example.com`);

  // Another patient books the same slot through the API in the meantime.
  const rival = await request.post("/bookings", {
    headers: { "X-API-Key": API_KEY },
    data: {
      slot_id: "e2e-b",
      name: "Rival",
      email: `rival-${randomUUID().slice(0, 8)}@example.com`,
    },
  });
  expect(rival.status()).toBe(201);

  await page.getByRole("button", { name: "Book appointment" }).click();
  // (Filtered by text: Next.js also renders a hidden route announcer with role="alert".)
  await expect(
    page.getByRole("alert").filter({ hasText: "someone has just booked this time" }),
  ).toBeVisible();
  await expect(slotCard(page, "Dr Bisi Bello")).toBeDisabled();
  await expect(slotCard(page, "Dr Bisi Bello")).toContainText("Booked");
});

test("the API key never reaches the browser", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (/javascript|html|json|x-component/.test(type))
      bodies.push(await res.text().catch(() => ""));
  });
  await page.goto("/");
  await slotCard(page, "Dr Ade Okafor").click();
  await page.waitForLoadState("networkidle");

  expect(API_KEY.length).toBeGreaterThan(0);
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) expect(body).not.toContain(API_KEY);
});
