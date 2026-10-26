const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { describe, it } = require("node:test");
const { join } = require("node:path");
const {
  PLATFORM_USER_ID_COLUMN_SQL,
  parseFinanceExchange,
  linkFinanceUserFromExchange,
} = require("./platform-link");

const root = __dirname;
const PLATFORM_A = "11111111-1111-4111-8111-111111111111";
const PLATFORM_B = "22222222-2222-4222-8222-222222222222";
const ACCESS = "platform-access-token";
const HASH = "bcrypt-hash-not-a-password";

function text(path) {
  return readFileSync(join(root, path), "utf8");
}

function row(partial) {
  return {
    id: partial.id,
    email: partial.email,
    password: partial.password === undefined ? HASH : partial.password,
    name: partial.name ?? "Finance User",
    role: partial.role ?? "user",
    company_id: partial.company_id === undefined ? 7 : partial.company_id,
    purchasing_editor: partial.purchasing_editor ?? true,
    auth_user_id: partial.auth_user_id ?? null,
    platform_user_id: partial.platform_user_id ?? null,
  };
}

function clone(value) {
  return structuredClone(value);
}

function duplicate() {
  const error = new Error("duplicate");
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  return error;
}

function memory(seed) {
  let rows = seed.map(clone);
  let queue = Promise.resolve();
  function api() {
    return {
      async findByPlatformId(id) {
        return rows.find((item) => item.platform_user_id === id) || null;
      },
      async findByAuthId(id) {
        return rows.find((item) => item.auth_user_id === id) || null;
      },
      async findByEmail(email) {
        return rows.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
      },
      async findById(id) {
        return rows.find((item) => item.id === id) || null;
      },
      async linkUnset(input) {
        await Promise.resolve();
        const current = rows.find(
          (item) =>
            item.id === input.id &&
            item.platform_user_id == null &&
            (item.auth_user_id == null || item.auth_user_id === input.platformUserId),
        );
        if (!current) return 0;
        if (rows.some((item) => item.id !== current.id && item.platform_user_id === input.platformUserId)) {
          throw duplicate();
        }
        current.platform_user_id = input.platformUserId;
        if (current.auth_user_id == null) current.auth_user_id = input.platformUserId;
        current.name = input.name;
        current.role = input.role;
        if (current.company_id == null) current.company_id = input.companyId;
        return 1;
      },
      async updateProfile(id, profile) {
        const current = rows.find((item) => item.id === id && item.platform_user_id != null);
        if (!current) return null;
        current.name = profile.name;
        current.role = profile.role;
        return current;
      },
      async insertUser(input) {
        if (
          input.platformUserId &&
          rows.some((item) => item.platform_user_id === input.platformUserId)
        ) {
          throw duplicate();
        }
        if (rows.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) throw duplicate();
        const created = row({
          id: rows.length + 1,
          email: input.email,
          password: input.password,
          name: input.name,
          role: input.role,
          company_id: input.companyId,
          purchasing_editor: false,
          auth_user_id: input.authUserId,
          platform_user_id: input.platformUserId,
        });
        rows.push(created);
        return created;
      },
    };
  }
  return {
    async transaction(fn) {
      const run = queue.then(async () => {
        const snapshot = rows.map(clone);
        try {
          return await fn(api());
        } catch (error) {
          rows = snapshot;
          throw error;
        }
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    snapshot() {
      return rows.map(clone);
    },
  };
}

function parsedExchange(user, module = "finance") {
  return parseFinanceExchange(true, {
    success: true,
    error: "database password leaked",
    data: {
      accessToken: ACCESS,
      refreshToken: "refresh-secret",
      token: "legacy-token",
      module,
      redirectPath: "/lists",
      user,
    },
  });
}

function input(overrides = {}) {
  const parsed = overrides.parsed || parsedExchange(overrides.user || {});
  return {
    sub: overrides.sub,
    email: overrides.email,
    name: overrides.name,
    plat: overrides.plat || false,
    mods: overrides.mods || ["finance"],
    roles: overrides.roles || { finance: "finance" },
    exchangeUserId: overrides.exchangeUserId === undefined ? parsed.userId : overrides.exchangeUserId,
    company: overrides.company === undefined ? { id: 7, purchasing_enabled: true } : overrides.company,
    requestBody: overrides.requestBody,
    hashPlaceholder: overrides.hashPlaceholder || (async () => "new-user-hash"),
  };
}

describe("reimbursement platform link", () => {
  it("adds a nullable unique column and does not rewrite rows", () => {
    const migrate = text("database/migrate.js");
    assert.equal(
      PLATFORM_USER_ID_COLUMN_SQL,
      "ALTER TABLE users ADD COLUMN platform_user_id VARCHAR(36) NULL UNIQUE",
    );
    assert.match(migrate, /columnExists\(db, "users", "platform_user_id"\)/);
    assert.match(migrate, /PLATFORM_USER_ID_COLUMN_SQL/);
    assert.equal(PLATFORM_USER_ID_COLUMN_SQL.includes("NOT NULL"), false);
    assert.equal(/\b(UPDATE|DELETE|DROP|INSERT|password|email)\b/i.test(PLATFORM_USER_ID_COLUMN_SQL), false);
    assert.equal(PLATFORM_USER_ID_COLUMN_SQL.includes("entries"), false);
    assert.equal(PLATFORM_USER_ID_COLUMN_SQL.includes("purchasing"), false);
  });

  it("allows many null links and rejects a repeated non-null id in the harness", async () => {
    const store = memory([]);
    await store.transaction(async (tx) => {
      await tx.insertUser({
        email: "a@whtb.test",
        password: HASH,
        name: "A",
        role: "user",
        companyId: 7,
        authUserId: null,
        platformUserId: null,
      });
      await tx.insertUser({
        email: "b@whtb.test",
        password: HASH,
        name: "B",
        role: "user",
        companyId: 7,
        authUserId: null,
        platformUserId: null,
      });
    });
    assert.deepEqual(
      store.snapshot().map((item) => item.platform_user_id),
      [null, null],
    );
    await assert.rejects(
      store.transaction(async (tx) => {
        await tx.insertUser({
          email: "c@whtb.test",
          password: HASH,
          name: "C",
          role: "user",
          companyId: 7,
          authUserId: PLATFORM_A,
          platformUserId: PLATFORM_A,
        });
        await tx.insertUser({
          email: "d@whtb.test",
          password: HASH,
          name: "D",
          role: "user",
          companyId: 7,
          authUserId: PLATFORM_A,
          platformUserId: PLATFORM_A,
        });
      }),
      (error) => error.code === "ER_DUP_ENTRY",
    );
  });

  it("keeps the local session token shape and omits the platform id", () => {
    const server = text("server.js");
    const signStart = server.indexOf("const token = jwt.sign(");
    const sign = server.slice(signStart, server.indexOf('expiresIn: "12h"', signStart));
    assert.match(sign, /id: user\.id/);
    assert.match(sign, /company_id/);
    assert.equal(sign.includes("platform_user_id"), false);
    assert.equal(sign.includes("password"), false);
    const me = server.slice(server.indexOf('app.get("/api/users/me"'), server.indexOf('app.put("/api/users/profile"'));
    assert.equal(me.includes("platform_user_id"), false);
    assert.equal(me.includes("password"), false);
  });

  it("links from the verified exchange subject and ignores the request body", async () => {
    const store = memory([row({ id: 4, email: "ada@whtb.test", role: "user" })]);
    const parsed = parsedExchange({
      id: `  ${PLATFORM_A.toUpperCase()}  `,
      email: "ada@whtb.test",
    });
    assert.equal(JSON.stringify(parsed).includes(ACCESS), false);
    assert.equal(JSON.stringify(parsed).includes("refresh-secret"), false);
    assert.equal(JSON.stringify(parsed).includes("database password"), false);
    let hashed = 0;
    const result = await linkFinanceUserFromExchange(
      store,
      input({
        sub: PLATFORM_A.toUpperCase(),
        email: "ada@whtb.test",
        name: "Ada Linked",
        exchangeUserId: parsed.userId,
        requestBody: { code: "launch", platformUserId: PLATFORM_B },
        hashPlaceholder: async () => {
          hashed += 1;
          return "new-user-hash";
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(hashed, 0);
    const saved = store.snapshot()[0];
    assert.equal(saved.platform_user_id, PLATFORM_A);
    assert.equal(saved.auth_user_id, PLATFORM_A);
    assert.equal(saved.id, 4);
    assert.equal(saved.role, "finance");
    assert.equal(saved.password, HASH);
    assert.equal(saved.company_id, 7);
    assert.equal(saved.purchasing_editor, true);
    assert.equal(JSON.stringify(result.user).includes(PLATFORM_A), false);
    assert.equal(JSON.stringify(result.user).includes(HASH), false);
    assert.equal(result.user.id, 4);
    assert.equal(result.user.purchasing_editor, true);
    assert.equal(result.user.token, undefined);
  });

  it("creates a platform admin without replacing an existing password column default", async () => {
    const store = memory([]);
    const result = await linkFinanceUserFromExchange(
      store,
      input({
        sub: PLATFORM_A,
        email: "admin@whtb.test",
        name: "Platform Admin",
        plat: true,
        mods: [],
        roles: { finance: "user" },
        exchangeUserId: PLATFORM_A,
        company: null,
        hashPlaceholder: async () => "placeholder-hash",
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.user.role, "superadmin");
    assert.equal(result.user.company_id, null);
    assert.equal(result.user.purchasing_enabled, true);
    const saved = store.snapshot()[0];
    assert.equal(saved.platform_user_id, PLATFORM_A);
    assert.equal(saved.password, "placeholder-hash");
    assert.equal(saved.purchasing_editor, false);
    assert.equal(saved.company_id, null);
  });

  it("repeats the same pair without changing the link or domain fields", async () => {
    const store = memory([
      row({
        id: 4,
        email: "ada@whtb.test",
        role: "finance",
        platform_user_id: PLATFORM_A,
        auth_user_id: PLATFORM_A,
        name: "Ada",
      }),
    ]);
    const result = await linkFinanceUserFromExchange(
      store,
      input({
        sub: PLATFORM_A,
        email: "ada@whtb.test",
        name: "Ada Two",
        exchangeUserId: PLATFORM_A,
        requestBody: { platformUserId: PLATFORM_B },
      }),
    );
    assert.equal(result.ok, true);
    const saved = store.snapshot()[0];
    assert.equal(saved.platform_user_id, PLATFORM_A);
    assert.equal(saved.name, "Ada Two");
    assert.equal(saved.password, HASH);
    assert.equal(saved.purchasing_editor, true);
    assert.equal(saved.company_id, 7);
  });

  it("prefers the platform id and lets email select only an unlinked row", async () => {
    const linked = memory([
      row({ id: 4, email: "ada@whtb.test", platform_user_id: PLATFORM_A, auth_user_id: PLATFORM_A, name: "Old" }),
      row({ id: 5, email: "other@whtb.test" }),
    ]);
    const preferred = await linkFinanceUserFromExchange(
      linked,
      input({
        sub: PLATFORM_A,
        email: "ada@whtb.test",
        name: "From Id",
        roles: { finance: "management" },
        exchangeUserId: PLATFORM_A,
      }),
    );
    assert.equal(preferred.ok, true);
    assert.equal(linked.snapshot()[0].name, "From Id");
    assert.equal(linked.snapshot()[0].role, "management");
    assert.equal(linked.snapshot()[1].platform_user_id, null);

    const unlinked = memory([row({ id: 5, email: "other@whtb.test", role: "user" })]);
    const byEmail = await linkFinanceUserFromExchange(
      unlinked,
      input({
        sub: PLATFORM_B,
        email: "other@whtb.test",
        name: "Other",
        roles: { finance: "stakeholder" },
        exchangeUserId: PLATFORM_B,
      }),
    );
    assert.equal(byEmail.ok, true);
    assert.equal(unlinked.snapshot()[0].platform_user_id, PLATFORM_B);
    assert.equal(unlinked.snapshot()[0].id, 5);
    assert.equal(unlinked.snapshot()[0].password, HASH);
  });

  it("returns identityConflict and leaves rows unchanged", async () => {
    const cases = [
      {
        name: "same platform id, different local user",
        seed: [
          row({ id: 4, email: "ada@whtb.test", platform_user_id: PLATFORM_A, auth_user_id: PLATFORM_A }),
          row({ id: 5, email: "other@whtb.test" }),
        ],
        email: "other@whtb.test",
        platformUserId: PLATFORM_A,
        company: { id: 7, purchasing_enabled: false },
      },
      {
        name: "same local user, different platform id",
        seed: [row({ id: 4, email: "ada@whtb.test", platform_user_id: PLATFORM_A, auth_user_id: PLATFORM_A })],
        email: "ada@whtb.test",
        platformUserId: PLATFORM_B,
        company: { id: 7, purchasing_enabled: false },
      },
      {
        name: "linked id email mismatch",
        seed: [row({ id: 4, email: "ada@whtb.test", platform_user_id: PLATFORM_A, auth_user_id: PLATFORM_A })],
        email: "moved@whtb.test",
        platformUserId: PLATFORM_A,
        company: { id: 7, purchasing_enabled: false },
      },
      {
        name: "existing auth id belongs to another platform user",
        seed: [row({ id: 4, email: "ada@whtb.test", auth_user_id: PLATFORM_B })],
        email: "ada@whtb.test",
        platformUserId: PLATFORM_A,
        company: { id: 7, purchasing_enabled: false },
      },
      {
        name: "linked user belongs to another company",
        seed: [row({ id: 4, email: "ada@whtb.test", platform_user_id: PLATFORM_A, auth_user_id: PLATFORM_A, company_id: 9 })],
        email: "ada@whtb.test",
        platformUserId: PLATFORM_A,
        company: { id: 7, purchasing_enabled: true },
      },
    ];
    for (const item of cases) {
      const store = memory(item.seed);
      const before = store.snapshot();
      const result = await linkFinanceUserFromExchange(
        store,
        input({
          sub: item.platformUserId,
          email: item.email,
          name: "Changed",
          roles: { finance: "finance" },
          exchangeUserId: item.platformUserId,
          company: item.company,
        }),
      );
      assert.equal(result.ok, false, item.name);
      assert.equal(result.status, 409, item.name);
      assert.deepEqual(result.body, { success: false, error: "identityConflict" });
      assert.equal(result.user, undefined);
      assert.deepEqual(store.snapshot(), before);
    }
  });

  it("treats a lost uniqueness race as a conflict without a partial write", async () => {
    const seed = [row({ id: 4, email: "ada@whtb.test" }), row({ id: 5, email: "other@whtb.test" })];
    let rows = seed.map(clone);
    const store = {
      async transaction(fn) {
        return fn({
          async findByPlatformId() {
            return null;
          },
          async findByAuthId() {
            return null;
          },
          async findByEmail(email) {
            return rows.find((item) => item.email === email) || null;
          },
          async findById(id) {
            return rows.find((item) => item.id === id) || null;
          },
          async linkUnset(link) {
            const winner = rows.find((item) => item.id !== link.id);
            if (winner) winner.platform_user_id = link.platformUserId;
            return 0;
          },
          async updateProfile() {
            throw new Error("loser must not update");
          },
          async insertUser() {
            throw new Error("not used");
          },
        });
      },
    };
    const lost = await linkFinanceUserFromExchange(
      store,
      input({ sub: PLATFORM_A, email: "ada@whtb.test", name: "Ada", exchangeUserId: PLATFORM_A }),
    );
    assert.equal(lost.ok, false);
    assert.equal(rows[0].platform_user_id, null);
    assert.equal(rows[0].role, "user");
    assert.equal(rows[0].password, HASH);
    assert.equal(rows[1].platform_user_id, PLATFORM_A);

    const racing = memory(seed);
    const [first, second] = await Promise.all([
      linkFinanceUserFromExchange(
        racing,
        input({ sub: PLATFORM_B, email: "ada@whtb.test", exchangeUserId: PLATFORM_B, roles: { finance: "finance" } }),
      ),
      linkFinanceUserFromExchange(
        racing,
        input({ sub: PLATFORM_B, email: "other@whtb.test", exchangeUserId: PLATFORM_B, roles: { finance: "finance" } }),
      ),
    ]);
    assert.deepEqual([first.ok, second.ok].sort(), [false, true]);
    assert.equal(racing.snapshot().filter((item) => item.platform_user_id === PLATFORM_B).length, 1);
    const loser = racing.snapshot().find((item) => item.platform_user_id !== PLATFORM_B);
    assert.equal(loser.password, HASH);
    assert.equal(loser.purchasing_editor, true);
  });

  it("rejects an invalid id, a failed exchange, the wrong module, and a missing grant", async () => {
    const store = memory([row({ id: 4, email: "ada@whtb.test" })]);
    const before = store.snapshot();
    const invalid = await linkFinanceUserFromExchange(
      store,
      input({ sub: "not-a-uuid", email: "ada@whtb.test", exchangeUserId: "not-a-uuid" }),
    );
    const mismatched = await linkFinanceUserFromExchange(
      store,
      input({ sub: PLATFORM_A, email: "ada@whtb.test", exchangeUserId: PLATFORM_B }),
    );
    const missingGrant = await linkFinanceUserFromExchange(
      store,
      input({
        sub: PLATFORM_A,
        email: "ada@whtb.test",
        mods: ["stock"],
        exchangeUserId: PLATFORM_A,
      }),
    );
    const failed = parseFinanceExchange(false, { success: false, error: "database password leaked" });
    const server = text("server.js");
    const sso = server.slice(server.indexOf('app.post("/api/auth/sso/exchange"'), server.indexOf('app.post("/api/auth/refresh"'));
    assert.match(sso, /parsed\.module !== "finance"/);
    assert.match(text("platform-link.js"), /Finance module not granted/);
    assert.equal(invalid.status, 401);
    assert.equal(mismatched.status, 401);
    assert.equal(missingGrant.status, 403);
    assert.equal(missingGrant.body.error, "Finance module not granted");
    assert.equal(failed.status, 401);
    assert.equal(failed.body.error, "Invalid or expired launch code");
    assert.equal(JSON.stringify(failed).includes("database password"), false);
    assert.equal(JSON.stringify(failed).includes(ACCESS), false);
    assert.deepEqual(store.snapshot(), before);
  });

  it("does not link when the verified subject is missing", async () => {
    const store = memory([row({ id: 4, email: "ada@whtb.test", role: "user" })]);
    const result = await linkFinanceUserFromExchange(
      store,
      input({
        sub: "   ",
        email: "ada@whtb.test",
        exchangeUserId: undefined,
        requestBody: { platformUserId: PLATFORM_A },
      }),
    );
    assert.equal(result.status, 401);
    assert.equal(store.snapshot()[0].platform_user_id, null);
    assert.equal(store.snapshot()[0].password, HASH);
    assert.equal(store.snapshot()[0].role, "user");
  });

  it("rolls back name, role, and link together when the write fails", async () => {
    const seed = row({ id: 4, email: "ada@whtb.test", role: "user", name: "Ada" });
    let rows = [clone(seed)];
    const store = {
      async transaction(fn) {
        const snapshot = rows.map(clone);
        try {
          return await fn({
            async findByPlatformId() {
              return null;
            },
            async findByAuthId() {
              return null;
            },
            async findByEmail(email) {
              return rows.find((item) => item.email === email) || null;
            },
            async findById(id) {
              return rows.find((item) => item.id === id) || null;
            },
            async linkUnset() {
              rows[0] = { ...rows[0], name: "Changed", role: "finance", platform_user_id: PLATFORM_A };
              throw new Error("disk");
            },
            async updateProfile() {
              throw new Error("not used");
            },
            async insertUser() {
              throw new Error("not used");
            },
          });
        } catch (error) {
          rows = snapshot;
          throw error;
        }
      },
    };
    const result = await linkFinanceUserFromExchange(
      store,
      input({ sub: PLATFORM_A, email: "ada@whtb.test", exchangeUserId: PLATFORM_A }),
    );
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "Login failed");
    assert.equal(rows[0].name, "Ada");
    assert.equal(rows[0].role, "user");
    assert.equal(rows[0].platform_user_id, null);
    assert.equal(rows[0].password, HASH);
    assert.equal(rows[0].purchasing_editor, true);
  });

  it("does not let password, dev, bearer, refresh, or provisioning write the link", () => {
    const server = text("server.js");
    const login = server.slice(server.indexOf('app.post("/api/auth/login"'), server.indexOf('app.post("/api/auth/sso/exchange"'));
    assert.equal(login.includes("platform_user_id"), false);
    assert.equal(login.includes("linkFinanceUserFromExchange"), false);
    assert.equal(server.includes('"/dev"'), false);
    const resolver = server.slice(
      server.indexOf("async function resolveFinanceUserFromPlatform"),
      server.indexOf("const authenticateToken"),
    );
    assert.equal(resolver.includes("platform_user_id"), false);
    const refresh = server.slice(server.indexOf('app.post("/api/auth/refresh"'), server.indexOf('app.post("/api/auth/logout"'));
    assert.equal(refresh.includes("linkFinanceUserFromExchange"), false);
    assert.equal(text("routes/purchasing.js").includes("platform_user_id"), false);
    assert.equal(text("database/seed.js").includes("platform_user_id"), false);
  });

  it("leaves reimbursement list, entry, and purchasing behavior untouched", () => {
    const server = text("server.js");
    assert.match(server, /FROM entries/);
    assert.match(server, /app\.get\("\/api\/lists"/);
    assert.equal(text("routes/purchasing.js").includes("platform_user_id"), false);
    assert.equal(PLATFORM_USER_ID_COLUMN_SQL.includes("entries"), false);
    assert.equal(PLATFORM_USER_ID_COLUMN_SQL.includes("lists"), false);
  });
});
