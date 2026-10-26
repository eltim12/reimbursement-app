const PLATFORM_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLATFORM_USER_ID_COLUMN_SQL =
  "ALTER TABLE users ADD COLUMN platform_user_id VARCHAR(36) NULL UNIQUE";

function normalizePlatformUserId(value) {
  if (value == null) return { id: null, invalid: false };
  if (typeof value !== "string") return { id: null, invalid: true };
  const trimmed = value.trim();
  if (!trimmed) return { id: null, invalid: false };
  if (!PLATFORM_USER_ID.test(trimmed)) return { id: null, invalid: true };
  return { id: trimmed.toLowerCase(), invalid: false };
}

function financeRoleFromExchange(input) {
  if (input.plat) return "superadmin";
  return input.roles?.finance || "user";
}

function parseFinanceExchange(httpOk, body) {
  const data = body?.data || body || {};
  if (!httpOk || !data.accessToken) {
    return {
      ok: false,
      status: 401,
      body: { success: false, error: "Invalid or expired launch code" },
    };
  }
  return {
    ok: true,
    module: data.module,
    redirectPath: data.redirectPath || null,
    userId: data.user ? data.user.id : undefined,
  };
}

function sameCompany(left, right) {
  if (left == null || right == null) return false;
  return Number(left) === Number(right);
}

function publicFinanceUser(row, input, role) {
  const purchasingEnabled = input.plat
    ? true
    : !!(input.company && input.company.purchasing_enabled);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    company_id: input.plat ? null : (row.company_id ?? input.company?.id ?? null),
    purchasing_editor: !!row.purchasing_editor,
    purchasing_enabled: purchasingEnabled,
    mods: input.mods || [],
  };
}

function isDuplicate(error) {
  return error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

async function applyFinancePlatformLink(store, input) {
  try {
    return await store.transaction(async (tx) => {
      const byPlatform = await tx.findByPlatformId(input.platformUserId);
      const byAuth = await tx.findByAuthId(input.platformUserId);
      const byEmail = await tx.findByEmail(input.email);
      if (byPlatform && byPlatform.email.toLowerCase() !== input.email.toLowerCase()) {
        return { ok: false, reason: "conflict" };
      }
      if (byPlatform && byAuth && byPlatform.id !== byAuth.id) {
        return { ok: false, reason: "conflict" };
      }
      if (byPlatform && byEmail && byPlatform.id !== byEmail.id) {
        return { ok: false, reason: "conflict" };
      }
      if (!byPlatform && byAuth && byAuth.email.toLowerCase() !== input.email.toLowerCase()) {
        return { ok: false, reason: "conflict" };
      }
      if (!byPlatform && byAuth && byEmail && byAuth.id !== byEmail.id) {
        return { ok: false, reason: "conflict" };
      }
      const target = byPlatform || byAuth || byEmail;
      const nextCompanyId = input.plat ? null : input.company?.id ?? null;
      if (target) {
        if (target.platform_user_id && target.platform_user_id !== input.platformUserId) {
          return { ok: false, reason: "conflict" };
        }
        if (target.auth_user_id && target.auth_user_id !== input.platformUserId) {
          return { ok: false, reason: "conflict" };
        }
        if (
          !input.plat &&
          target.company_id != null &&
          nextCompanyId != null &&
          !sameCompany(target.company_id, nextCompanyId)
        ) {
          return { ok: false, reason: "conflict" };
        }
        const profile = {
          name: input.name || target.name,
          role: input.role,
        };
        if (!target.platform_user_id) {
          const linked = await tx.linkUnset({
            id: target.id,
            platformUserId: input.platformUserId,
            authUserId: target.auth_user_id,
            name: profile.name,
            role: profile.role,
            companyId: input.plat ? null : nextCompanyId,
          });
          if (linked !== 1) {
            const again = await tx.findById(target.id);
            if (
              !again ||
              again.platform_user_id !== input.platformUserId ||
              again.email.toLowerCase() !== input.email.toLowerCase()
            ) {
              return { ok: false, reason: "conflict" };
            }
            const saved = await tx.updateProfile(again.id, profile);
            return { ok: true, user: saved };
          }
          const saved = await tx.findById(target.id);
          if (!saved || saved.platform_user_id !== input.platformUserId) {
            const error = new Error("link");
            error.code = "LINK_CONFLICT";
            throw error;
          }
          return { ok: true, user: saved };
        }
        const saved = await tx.updateProfile(target.id, profile);
        if (!saved || saved.platform_user_id !== input.platformUserId) {
          const error = new Error("link");
          error.code = "LINK_CONFLICT";
          throw error;
        }
        return { ok: true, user: saved };
      }
      const password = await input.hashPlaceholder();
      const created = await tx.insertUser({
        email: input.email.toLowerCase().trim(),
        password,
        name: input.name,
        role: input.role,
        companyId: input.plat ? null : nextCompanyId,
        authUserId: input.platformUserId,
        platformUserId: input.platformUserId,
      });
      return { ok: true, user: created };
    });
  } catch (error) {
    if (isDuplicate(error) || error?.code === "LINK_CONFLICT") {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }
}

async function linkFinanceUserFromExchange(store, input) {
  void input.requestBody;
  const sub = normalizePlatformUserId(input.sub);
  if (sub.invalid || !sub.id) {
    return {
      ok: false,
      status: 401,
      body: { success: false, error: "Invalid or expired launch code" },
    };
  }
  if (input.exchangeUserId != null && String(input.exchangeUserId).trim() !== "") {
    const exchangeId = normalizePlatformUserId(input.exchangeUserId);
    if (exchangeId.invalid || exchangeId.id !== sub.id) {
      return {
        ok: false,
        status: 401,
        body: { success: false, error: "Invalid or expired launch code" },
      };
    }
  }
  if (!input.plat && !(input.mods || []).includes("finance")) {
    return {
      ok: false,
      status: 403,
      body: { success: false, error: "Finance module not granted" },
    };
  }
  const email = String(input.email || "").trim();
  if (!email) {
    return {
      ok: false,
      status: 401,
      body: { success: false, error: "Invalid or expired launch code" },
    };
  }
  const role = financeRoleFromExchange(input);
  let linked;
  try {
    linked = await applyFinancePlatformLink(store, {
      platformUserId: sub.id,
      email,
      name: input.name || email,
      role,
      plat: !!input.plat,
      company: input.company || null,
      hashPlaceholder: input.hashPlaceholder,
    });
  } catch {
    return {
      ok: false,
      status: 500,
      body: { success: false, error: "Login failed" },
    };
  }
  if (!linked.ok) {
    return {
      ok: false,
      status: 409,
      body: { success: false, error: "identityConflict" },
    };
  }
  return {
    ok: true,
    user: publicFinanceUser(linked.user, input, role),
  };
}

function createMysqlLinkStore(pool) {
  function tx(conn) {
    return {
      async findByPlatformId(id) {
        const [rows] = await conn.query(
          `SELECT id, email, password, name, role, company_id, purchasing_editor,
                  auth_user_id, platform_user_id
           FROM users WHERE platform_user_id = ? LIMIT 1`,
          [id],
        );
        return rows[0] || null;
      },
      async findByAuthId(id) {
        const [rows] = await conn.query(
          `SELECT id, email, password, name, role, company_id, purchasing_editor,
                  auth_user_id, platform_user_id
           FROM users WHERE auth_user_id = ? LIMIT 1`,
          [id],
        );
        return rows[0] || null;
      },
      async findByEmail(email) {
        const [rows] = await conn.query(
          `SELECT id, email, password, name, role, company_id, purchasing_editor,
                  auth_user_id, platform_user_id
           FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
          [email],
        );
        return rows[0] || null;
      },
      async findById(id) {
        const [rows] = await conn.query(
          `SELECT id, email, password, name, role, company_id, purchasing_editor,
                  auth_user_id, platform_user_id
           FROM users WHERE id = ? LIMIT 1`,
          [id],
        );
        return rows[0] || null;
      },
      async linkUnset(input) {
        const [result] = await conn.query(
          `UPDATE users
           SET platform_user_id = ?,
               auth_user_id = IF(auth_user_id IS NULL, ?, auth_user_id),
               name = ?,
               role = ?,
               company_id = IF(company_id IS NULL, ?, company_id)
           WHERE id = ?
             AND platform_user_id IS NULL
             AND (auth_user_id IS NULL OR auth_user_id = ?)`,
          [
            input.platformUserId,
            input.platformUserId,
            input.name,
            input.role,
            input.companyId,
            input.id,
            input.platformUserId,
          ],
        );
        return result.affectedRows;
      },
      async updateProfile(id, profile) {
        await conn.query(
          `UPDATE users SET name = ?, role = ?
           WHERE id = ? AND platform_user_id IS NOT NULL`,
          [profile.name, profile.role, id],
        );
        return this.findById(id);
      },
      async insertUser(input) {
        const [result] = await conn.query(
          `INSERT INTO users
             (email, password, name, role, company_id, auth_user_id, platform_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            input.email,
            input.password,
            input.name,
            input.role,
            input.companyId,
            input.authUserId,
            input.platformUserId,
          ],
        );
        return this.findById(result.insertId);
      },
    };
  }

  return {
    async transaction(fn) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const out = await fn(tx(conn));
        await conn.commit();
        return out;
      } catch (error) {
        try {
          await conn.rollback();
        } catch {
          /* rollback already failed */
        }
        throw error;
      } finally {
        conn.release();
      }
    },
  };
}

module.exports = {
  PLATFORM_USER_ID_COLUMN_SQL,
  normalizePlatformUserId,
  financeRoleFromExchange,
  parseFinanceExchange,
  linkFinanceUserFromExchange,
  createMysqlLinkStore,
};
