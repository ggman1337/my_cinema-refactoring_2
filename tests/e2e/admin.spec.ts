import { expect, test, Page } from "@playwright/test";

const DEFAULT_PAGE = 0;
const PAGE_SIZES = {
  ADMIN_FILMS_LOOKUP: 50,
  ADMIN_MOVIES: 20,
  ADMIN_CATEGORIES: 20,
  ADMIN_SESSIONS: 50,
};

const moviesResponse = {
  data: [
    {
      id: "m1",
      title: "Film One",
      description: "Desc 1",
      durationMinutes: 120,
      ageRating: "12+",
    },
    {
      id: "m2",
      title: "Film Two",
      description: "Desc 2",
      durationMinutes: 90,
      ageRating: "16+",
    },
  ],
};

const categoriesResponse = {
  data: [
    { id: "c1", name: "VIP", priceCents: 500 },
    { id: "c2", name: "Standard", priceCents: 300 },
  ],
};

const hallsResponse = {
  data: [
    { id: "h1", name: "Hall 1" },
    { id: "h2", name: "Hall 2" },
  ],
};

const sessionsResponse = {
  data: [
    {
      id: "s1",
      filmId: "m1",
      hallId: "h1",
      startAt: "2025-01-01T10:00:00.000Z",
    },
  ],
};

const toBase64Url = (payload: object) => {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const createFakeAdminToken = () => {
  const header = toBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = toBase64Url({
    sub: "test",
    role: "ADMIN",
    exp: 4102444800,
    iat: 0,
  });
  return `${header}.${payload}.signature`;
};

const addAdminToken = async (page: Page) => {
  const token = createFakeAdminToken();
  await page.addInitScript((value) => {
    localStorage.setItem("token", value);
  }, token);
};

const mockAdminApi = async (page: Page) => {
  await page.route(
    `**/films?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_MOVIES}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(moviesResponse),
      });
    }
  );

  await page.route("**/films/m1", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.route("**/films/m2", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.route(
    `**/films?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_FILMS_LOOKUP}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(moviesResponse),
      });
    }
  );

  await page.route(
    `**/seat-categories?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_CATEGORIES}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(categoriesResponse),
      });
    }
  );

  await page.route("**/seat-categories/c1", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.route("**/seat-categories/c2", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.route("**/halls", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(hallsResponse),
    });
  });

  await page.route(
    `**/sessions?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_SESSIONS}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionsResponse),
      });
    }
  );

  await page.route("**/sessions/s1", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });
};

const prepareAdmin = async (page: Page) => {
  await addAdminToken(page);
  page.on("dialog", (dialog) => dialog.accept());
  await mockAdminApi(page);
};

test("должен показывать фильмы из API на странице админа", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: /Управление фильмами/i })).toBeVisible();
  await expect(page.getByTestId("movie-row-m1")).toBeVisible();
  await expect(page.getByTestId("movie-row-m2")).toBeVisible();
});

test("должен удалять фильм после подтверждения", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  const deleteRequest = page.waitForRequest(
    (request) => request.method() === "DELETE" && request.url().includes("/films/m1")
  );

  await page.getByTestId("movie-delete-m1").click();

  await deleteRequest;
  await expect(page.getByTestId("movie-row-m1")).toHaveCount(0);
});

test("должен показывать категории после перехода в раздел Категории", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await page.getByTestId("admin-nav-categories").click();

  await expect(
    page.getByRole("heading", { name: /Управление категориями мест/i })
  ).toBeVisible();
  await expect(page.getByTestId("category-row-c1")).toBeVisible();
  await expect(page.getByTestId("category-row-c2")).toBeVisible();
});

test("должен удалять категорию после подтверждения", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await page.getByTestId("admin-nav-categories").click();

  const deleteRequest = page.waitForRequest(
    (request) =>
      request.method() === "DELETE" && request.url().includes("/seat-categories/c1")
  );

  await page.getByTestId("category-delete-c1").click();

  await deleteRequest;
  await expect(page.getByTestId("category-row-c1")).toHaveCount(0);
});

test("должен показывать сеансы после перехода в раздел Сеансы", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await page.getByTestId("admin-nav-sessions").click();

  await expect(page.getByTestId("session-row-s1")).toBeVisible();
});

test("должен удалять сеанс после подтверждения", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await page.getByTestId("admin-nav-sessions").click();

  const deleteRequest = page.waitForRequest(
    (request) => request.method() === "DELETE" && request.url().includes("/sessions/s1")
  );

  await page.getByTestId("session-delete-s1").click();

  await deleteRequest;
  await expect(page.getByTestId("session-row-s1")).toHaveCount(0);
});
