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

test("должен создавать новый фильм", async ({ page }) => {
  await prepareAdmin(page);

  let moviesFetchCount = 0;
  await page.route(
    `**/films?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_MOVIES}`,
    async (route) => {
      moviesFetchCount += 1;
      const body =
        moviesFetchCount === 1
          ? moviesResponse
          : {
              data: [
                ...moviesResponse.data,
                {
                  id: "m3",
                  title: "Film Three",
                  description: "Desc 3",
                  durationMinutes: 100,
                  ageRating: "18+",
                },
              ],
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );

  await page.route("**/films", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "m3" }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin");

  await page.getByTestId("movie-create").click();

  await page.getByTestId("movie-title-input").fill("Film Three");
  await page.getByTestId("movie-description-input").fill("Desc 3");
  await page.getByTestId("movie-duration-input").fill("100");
  await page.getByTestId("movie-ageRating-input").fill("18+");

  const saveRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/films")
  );

  await page.getByTestId("movie-save").click();

  await saveRequest;
  await expect(page.getByTestId("movie-row-m3")).toBeVisible();
});

test("должен редактировать фильм", async ({ page }) => {
  await prepareAdmin(page);

  let moviesFetchCount = 0;
  await page.route(
    `**/films?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_MOVIES}`,
    async (route) => {
      moviesFetchCount += 1;
      const body =
        moviesFetchCount === 1
          ? moviesResponse
          : {
              data: [
                {
                  ...moviesResponse.data[0],
                  title: "Film One Updated",
                },
                moviesResponse.data[1],
              ],
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );

  await page.route("**/films/m1", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200, body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin");

  await page.getByTestId("movie-edit-m1").click();

  await page.getByTestId("movie-title-input").fill("Film One Updated");

  const updateRequest = page.waitForRequest(
    (request) => request.method() === "PUT" && request.url().includes("/films/m1")
  );

  await page.getByTestId("movie-save").click();

  await updateRequest;
  await expect(page.getByTestId("movie-row-m1")).toContainText("Film One Updated");
});

test("должен валидировать категорию без названия", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/admin");

  await page.getByTestId("admin-nav-categories").click();

  await page.getByTestId("category-create").click();

  const dialogPromise = page.waitForEvent("dialog");
  await page.getByTestId("category-save").click();

  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("alert");
});

test("должен создавать категорию мест", async ({ page }) => {
  await prepareAdmin(page);

  let categoriesFetchCount = 0;
  await page.route(
    `**/seat-categories?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_CATEGORIES}`,
    async (route) => {
      categoriesFetchCount += 1;
      const body =
        categoriesFetchCount === 1
          ? categoriesResponse
          : {
              data: [
                ...categoriesResponse.data,
                { id: "c3", name: "Comfort", priceCents: 400 },
              ],
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );

  await page.route("**/seat-categories", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin");
  await page.getByTestId("admin-nav-categories").click();

  await page.getByTestId("category-create").click();

  await page.getByTestId("category-name-input").fill("Comfort");
  await page.getByTestId("category-price-input").fill("4");

  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("/seat-categories")
  );

  await page.getByTestId("category-save").click();
  await saveRequest;

  await expect(page.getByTestId("category-row-c3")).toBeVisible();
});

test("должен создавать сеанс с повторением", async ({ page }) => {
  await prepareAdmin(page);

  let sessionsFetchCount = 0;
  await page.route(
    `**/sessions?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_SESSIONS}`,
    async (route) => {
      sessionsFetchCount += 1;
      const body =
        sessionsFetchCount === 1
          ? sessionsResponse
          : {
              data: [
                ...sessionsResponse.data,
                {
                  id: "s2",
                  filmId: "m2",
                  hallId: "h2",
                  startAt: "2026-01-10T10:00:00.000Z",
                },
              ],
            };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );

  await page.route("**/sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin");
  await page.getByTestId("admin-nav-sessions").click();

  await page.getByTestId("session-create").click();

  await page.getByTestId("session-film-select").selectOption("m2");
  await page.getByTestId("session-hall-select").selectOption("h2");
  await page.getByTestId("session-start-input").fill("2026-01-10T10:00");
  await page.getByTestId("session-periodic-check").check();
  await page.getByTestId("session-period-end-input").fill("2026-01-17T10:00");

  await expect(page.locator(".alert.alert-info")).toBeVisible();

  const saveRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/sessions")
  );

  await page.getByTestId("session-save").click();
  await saveRequest;

  await expect(page.getByTestId("session-row-s2")).toBeVisible();
});

test("должен редактировать сеанс", async ({ page }) => {
  await prepareAdmin(page);

  await page.route("**/sessions/s1", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200, body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin");
  await page.getByTestId("admin-nav-sessions").click();

  await page.getByTestId("session-edit-s1").click();

  await page.getByTestId("session-start-input").fill("2026-01-02T11:00");

  const updateRequest = page.waitForRequest(
    (request) => request.method() === "PUT" && request.url().includes("/sessions/s1")
  );

  await page.getByTestId("session-save").click();
  await updateRequest;
});
