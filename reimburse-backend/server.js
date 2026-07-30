const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const db = require("./config/database");
const {
  compressAndSaveImage,
  deleteImage,
} = require("./utils/imageCompression");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "your_super_secret_jwt_key_should_be_in_env";

// Ensure public/images directory exists
const publicImagesDir = path.join(__dirname, "public", "images");
fs.ensureDirSync(publicImagesDir);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use("/images", express.static(path.join(__dirname, "public", "images")));

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ success: false, error: "Access denied" });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err)
      return res.status(403).json({ success: false, error: "Invalid token" });

    try {
      const [users] = await db.query(
        "SELECT id, email, role, company_id FROM users WHERE id = ?",
        [decoded.id],
      );
      if (users.length === 0) {
        return res.status(403).json({ success: false, error: "Invalid token" });
      }
      req.user = {
        id: users[0].id,
        email: users[0].email,
        role: users[0].role || "user",
        company_id: users[0].company_id ?? null,
      };
      next();
    } catch (error) {
      console.error("Auth lookup error:", error);
      return res.status(500).json({ success: false, error: "Auth failed" });
    }
  });
};

const ALLOWED_ROLES = ["user", "admin", "management", "finance"];
const isSuperadmin = (user) => user?.role === "superadmin";
const isManagement = (user) => user?.role === "management";
const isFinance = (user) => user?.role === "finance";
const isAdmin = (user) => user?.role === "admin";
const canViewAllLists = (user) =>
  isSuperadmin(user) ||
  ((isManagement(user) || isFinance(user)) && !!user?.company_id);
const canManageCategories = (user) =>
  isSuperadmin(user) ||
  ((isManagement(user) || isFinance(user) || isAdmin(user)) &&
    !!user?.company_id);

const requireManagement = (req, res, next) => {
  if (isSuperadmin(req.user)) return next();
  if (!isManagement(req.user) || !req.user.company_id) {
    return res
      .status(403)
      .json({ success: false, error: "Management access required" });
  }
  next();
};

const requireCategoryAdmin = (req, res, next) => {
  if (!canManageCategories(req.user)) {
    return res
      .status(403)
      .json({ success: false, error: "Category admin access required" });
  }
  next();
};

const requireSuperadmin = (req, res, next) => {
  if (!isSuperadmin(req.user)) {
    return res
      .status(403)
      .json({ success: false, error: "Superadmin access required" });
  }
  next();
};

/** Company members or platform superadmin (cross-tenant viewers). */
const requireCompanyUser = (req, res, next) => {
  if (isSuperadmin(req.user)) return next();
  if (!req.user.company_id) {
    return res
      .status(403)
      .json({ success: false, error: "Company membership required" });
  }
  next();
};

const requireAnalyticsAccess = (req, res, next) => {
  if (isSuperadmin(req.user)) return next();
  if (!req.user.company_id) {
    return res
      .status(403)
      .json({ success: false, error: "Analytics access required" });
  }
  next();
};

/**
 * Resolve optional company scope.
 * Superadmin: query/body companyId (null = all companies).
 * Others: always own company_id.
 */
const resolveCompanyFilter = (req, { required = false } = {}) => {
  if (isSuperadmin(req.user)) {
    const raw =
      req.query?.companyId ??
      req.body?.company_id ??
      req.body?.companyId ??
      null;
    if (raw === undefined || raw === null || raw === "") {
      if (required) {
        return { error: "company_id is required" };
      }
      return { companyId: null };
    }
    const companyId = Number(raw);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return { error: "Invalid company_id" };
    }
    return { companyId };
  }
  if (!req.user.company_id) {
    return { error: "Company membership required" };
  }
  return { companyId: req.user.company_id };
};

const { categoryValue, mapCategoryRow, seedCategoriesForCompany } = require(
  "./database/categories",
);
const { slugify } = require("./database/companies");

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Reimbursement API is running" });
});

// Auth Routes — public employee signup disabled (management creates users)
app.post("/api/auth/register", (_req, res) => {
  return res.status(403).json({
    success: false,
    error: "Public registration is disabled. Ask your company management to create an account.",
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid email or password" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid email or password" });
    }

    const role = user.role || "user";
    const company_id = user.company_id ?? null;

    const token = jwt.sign(
      { id: user.id, email: user.email, role, company_id },
      JWT_SECRET,
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        company_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Categories — company-scoped (superadmin: optional companyId filter)
app.get(
  "/api/categories",
  authenticateToken,
  requireCompanyUser,
  async (req, res) => {
    try {
      const scope = resolveCompanyFilter(req);
      if (scope.error) {
        return res.status(400).json({ success: false, error: scope.error });
      }

      let rows;
      if (scope.companyId == null) {
        [rows] = await db.query(
          `SELECT c.id, c.company_id, c.name_id, c.name_zh, c.sort_order,
                  c.created_at, c.updated_at, co.name AS company_name
           FROM categories c
           LEFT JOIN companies co ON co.id = c.company_id
           ORDER BY co.name ASC, c.sort_order ASC, c.id ASC`,
        );
      } else {
        [rows] = await db.query(
          `SELECT c.id, c.company_id, c.name_id, c.name_zh, c.sort_order,
                  c.created_at, c.updated_at, co.name AS company_name
           FROM categories c
           LEFT JOIN companies co ON co.id = c.company_id
           WHERE c.company_id = ?
           ORDER BY c.sort_order ASC, c.id ASC`,
          [scope.companyId],
        );
      }

      res.json({
        success: true,
        companyId: scope.companyId,
        categories: rows.map((row) => ({
          ...mapCategoryRow(row),
          company_name: row.company_name || null,
        })),
      });
    } catch (error) {
      console.error("Error loading categories:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.post(
  "/api/categories",
  authenticateToken,
  requireCategoryAdmin,
  async (req, res) => {
    try {
      const scope = resolveCompanyFilter(req, { required: true });
      if (scope.error) {
        return res.status(400).json({ success: false, error: scope.error });
      }
      const companyId = scope.companyId;
      const name_id = String(req.body.name_id || "").trim();
      const name_zh = String(req.body.name_zh || "").trim();

      if (!name_id || !name_zh) {
        return res.status(400).json({
          success: false,
          error: "Both Indonesian and Chinese names are required",
        });
      }

      const [existing] = await db.query(
        `SELECT id FROM categories
         WHERE company_id = ? AND (name_id = ? OR name_zh = ?)`,
        [companyId, name_id, name_zh],
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Category name already exists",
        });
      }

      const [maxRows] = await db.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
         FROM categories WHERE company_id = ?`,
        [companyId],
      );
      const sort_order = Number(maxRows[0]?.max_sort || 0) + 1;

      const [result] = await db.query(
        `INSERT INTO categories (company_id, name_id, name_zh, sort_order)
         VALUES (?, ?, ?, ?)`,
        [companyId, name_id, name_zh, sort_order],
      );

      const [rows] = await db.query(
        `SELECT id, company_id, name_id, name_zh, sort_order, created_at, updated_at
         FROM categories WHERE id = ? AND company_id = ?`,
        [result.insertId, companyId],
      );

      res.json({ success: true, category: mapCategoryRow(rows[0]) });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.put(
  "/api/categories/:id",
  authenticateToken,
  requireCategoryAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const name_id = String(req.body.name_id || "").trim();
      const name_zh = String(req.body.name_zh || "").trim();

      if (!name_id || !name_zh) {
        return res.status(400).json({
          success: false,
          error: "Both Indonesian and Chinese names are required",
        });
      }

      let existing;
      if (isSuperadmin(req.user)) {
        [existing] = await db.query(
          "SELECT id, company_id, name_id, name_zh FROM categories WHERE id = ?",
          [id],
        );
      } else {
        [existing] = await db.query(
          `SELECT id, company_id, name_id, name_zh FROM categories
           WHERE id = ? AND company_id = ?`,
          [id, req.user.company_id],
        );
      }
      if (existing.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found" });
      }

      const companyId = existing[0].company_id;

      const [dupes] = await db.query(
        `SELECT id FROM categories
         WHERE company_id = ? AND (name_id = ? OR name_zh = ?) AND id <> ?`,
        [companyId, name_id, name_zh, id],
      );
      if (dupes.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Category name already exists",
        });
      }

      const oldValue = categoryValue(existing[0].name_id, existing[0].name_zh);
      const newValue = categoryValue(name_id, name_zh);

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE categories SET name_id = ?, name_zh = ?
           WHERE id = ? AND company_id = ?`,
          [name_id, name_zh, id, companyId],
        );
        if (oldValue !== newValue) {
          await connection.query(
            `UPDATE entries e
             INNER JOIN lists l ON l.id = e.list_id
             INNER JOIN users u ON u.id = l.user_id
             SET e.category = ?
             WHERE e.category = ? AND u.company_id = ?`,
            [newValue, oldValue, companyId],
          );
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      const [rows] = await db.query(
        `SELECT id, company_id, name_id, name_zh, sort_order, created_at, updated_at
         FROM categories WHERE id = ? AND company_id = ?`,
        [id, companyId],
      );

      res.json({ success: true, category: mapCategoryRow(rows[0]) });
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.delete(
  "/api/categories/:id",
  authenticateToken,
  requireCategoryAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      let existing;
      if (isSuperadmin(req.user)) {
        [existing] = await db.query(
          "SELECT id, company_id, name_id, name_zh FROM categories WHERE id = ?",
          [id],
        );
      } else {
        [existing] = await db.query(
          `SELECT id, company_id, name_id, name_zh FROM categories
           WHERE id = ? AND company_id = ?`,
          [id, req.user.company_id],
        );
      }
      if (existing.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found" });
      }

      const companyId = existing[0].company_id;
      const value = categoryValue(existing[0].name_id, existing[0].name_zh);
      const [inUse] = await db.query(
        `SELECT COUNT(*) AS c
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         WHERE e.category = ? AND u.company_id = ?`,
        [value, companyId],
      );
      if (Number(inUse[0]?.c) > 0) {
        return res.status(400).json({
          success: false,
          error: "Category is used by existing entries and cannot be deleted",
        });
      }

      await db.query("DELETE FROM categories WHERE id = ? AND company_id = ?", [
        id,
        companyId,
      ]);
      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Analytics: company users scoped; superadmin all or by companyId
app.get(
  "/api/analytics",
  authenticateToken,
  requireAnalyticsAccess,
  async (req, res) => {
    try {
      const scope = resolveCompanyFilter(req);
      if (scope.error) {
        return res.status(400).json({ success: false, error: scope.error });
      }
      const companyId = scope.companyId;
      const { category, dateFrom, dateTo, ownerId } = req.query;
      const scopedToSelf = !canViewAllLists(req.user);

      const where = [];
      const params = [];

      if (companyId != null) {
        where.push("u.company_id = ?");
        params.push(companyId);
      } else if (!isSuperadmin(req.user)) {
        where.push("u.company_id = ?");
        params.push(req.user.company_id);
      }

      if (category) {
        where.push("e.category = ?");
        params.push(category);
      }
      if (dateFrom) {
        where.push("e.date >= ?");
        params.push(dateFrom);
      }
      if (dateTo) {
        where.push("e.date <= ?");
        params.push(dateTo);
      }

      if (scopedToSelf) {
        where.push("l.user_id = ?");
        params.push(req.user.id);
      } else if (ownerId) {
        where.push("l.user_id = ?");
        params.push(Number(ownerId));
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [summaryRows] = await db.query(
        `SELECT
           COALESCE(SUM(e.amount), 0) AS total_amount,
           COUNT(e.id) AS entry_count,
           COUNT(DISTINCT e.list_id) AS list_count
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         ${whereSql}`,
        params,
      );

      const [byCategory] = await db.query(
        `SELECT
           e.category AS category,
           COALESCE(SUM(e.amount), 0) AS total_amount,
           COUNT(e.id) AS entry_count
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         ${whereSql}
         GROUP BY e.category
         ORDER BY total_amount DESC, e.category ASC`,
        params,
      );

      const [entries] = await db.query(
        `SELECT
           e.id,
           e.date,
           e.category,
           e.note,
           e.amount,
           e.list_id,
           l.name AS list_name,
           u.id AS owner_id,
           u.name AS owner_name,
           u.email AS owner_email,
           u.company_id AS company_id,
           co.name AS company_name
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         LEFT JOIN companies co ON co.id = u.company_id
         ${whereSql}
         ORDER BY e.date DESC, e.id DESC
         LIMIT 500`,
        params,
      );

      let owners = [];
      if (scopedToSelf) {
        const [selfRows] = await db.query(
          "SELECT id, name, email, company_id FROM users WHERE id = ?",
          [req.user.id],
        );
        owners = selfRows;
      } else if (companyId != null) {
        const [ownerRows] = await db.query(
          `SELECT DISTINCT u.id, u.name, u.email, u.company_id
           FROM users u
           INNER JOIN lists l ON l.user_id = u.id
           WHERE u.company_id = ?
           ORDER BY u.name ASC, u.email ASC`,
          [companyId],
        );
        owners = ownerRows;
      } else {
        const [ownerRows] = await db.query(
          `SELECT DISTINCT u.id, u.name, u.email, u.company_id
           FROM users u
           INNER JOIN lists l ON l.user_id = u.id
           WHERE u.company_id IS NOT NULL
           ORDER BY u.name ASC, u.email ASC`,
        );
        owners = ownerRows;
      }

      const summary = summaryRows[0] || {};

      res.json({
        success: true,
        scopedToSelf,
        companyId,
        summary: {
          totalAmount: parseFloat(summary.total_amount) || 0,
          entryCount: Number(summary.entry_count) || 0,
          listCount: Number(summary.list_count) || 0,
        },
        byCategory: byCategory.map((row) => ({
          category: row.category || "(empty)",
          totalAmount: parseFloat(row.total_amount) || 0,
          entryCount: Number(row.entry_count) || 0,
        })),
        entries: entries.map((entry) => ({
          id: entry.id,
          date: entry.date.toISOString().split("T")[0],
          category: entry.category,
          note: entry.note || "",
          amount: parseFloat(entry.amount),
          listId: entry.list_id,
          listName: entry.list_name,
          ownerId: entry.owner_id,
          ownerName: entry.owner_name || "",
          ownerEmail: entry.owner_email || "",
          companyId: entry.company_id,
          companyName: entry.company_name || "",
        })),
        owners: owners.map((owner) => ({
          id: owner.id,
          name: owner.name || "",
          email: owner.email,
          companyId: owner.company_id ?? null,
        })),
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Management / superadmin: list users (optional companyId for superadmin)
app.get("/api/admin/users", authenticateToken, requireManagement, async (req, res) => {
  try {
    const scope = resolveCompanyFilter(req);
    if (scope.error) {
      return res.status(400).json({ success: false, error: scope.error });
    }

    let users;
    if (scope.companyId == null) {
      [users] = await db.query(
        `SELECT u.id, u.email, u.name, u.role, u.company_id, u.created_at, u.updated_at,
                c.name AS company_name
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.role <> 'superadmin'
         ORDER BY c.name ASC, u.created_at DESC`,
      );
    } else {
      [users] = await db.query(
        `SELECT u.id, u.email, u.name, u.role, u.company_id, u.created_at, u.updated_at,
                c.name AS company_name
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.company_id = ?
         ORDER BY u.created_at DESC`,
        [scope.companyId],
      );
    }

    res.json({
      success: true,
      companyId: scope.companyId,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name || "",
        role: user.role || "user",
        company_id: user.company_id,
        company_name: user.company_name || null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user (management: own company; superadmin: any company via company_id)
app.post("/api/admin/users", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const scope = resolveCompanyFilter(req, { required: true });
    if (scope.error) {
      return res.status(400).json({ success: false, error: scope.error });
    }
    const companyId = scope.companyId;

    const [companies] = await db.query(
      "SELECT id FROM companies WHERE id = ?",
      [companyId],
    );
    if (companies.length === 0) {
      return res.status(400).json({ success: false, error: "Company not found" });
    }

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required" });
    }
    if (!/.+@.+\..+/.test(email)) {
      return res.status(400).json({ success: false, error: "Email must be valid" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    if (role === "superadmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot create superadmin via this endpoint",
      });
    }

    const nextRole = ALLOWED_ROLES.includes(role) ? role : "user";

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email.trim(),
    ]);
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)",
      [email.trim(), hashedPassword, (name || "").trim(), nextRole, companyId],
    );

    res.json({
      success: true,
      user: {
        id: result.insertId,
        email: email.trim(),
        name: (name || "").trim(),
        role: nextRole,
        company_id: companyId,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user
app.put("/api/admin/users/:id", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, role, company_id: bodyCompanyId } = req.body;

    let users;
    if (isSuperadmin(req.user)) {
      [users] = await db.query(
        "SELECT id, role, company_id FROM users WHERE id = ? AND role <> 'superadmin'",
        [id],
      );
    } else {
      [users] = await db.query(
        "SELECT id, role, company_id FROM users WHERE id = ? AND company_id = ?",
        [id, req.user.company_id],
      );
    }
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!/.+@.+\..+/.test(email)) {
      return res.status(400).json({ success: false, error: "Email must be valid" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    if (role === "superadmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot assign superadmin role",
      });
    }

    const nextRole = ALLOWED_ROLES.includes(role) ? role : users[0].role || "user";
    let companyId = users[0].company_id;
    if (isSuperadmin(req.user) && bodyCompanyId != null && bodyCompanyId !== "") {
      companyId = Number(bodyCompanyId);
      const [companies] = await db.query(
        "SELECT id FROM companies WHERE id = ?",
        [companyId],
      );
      if (companies.length === 0) {
        return res.status(400).json({ success: false, error: "Company not found" });
      }
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email.trim(), id],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 6 characters",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        "UPDATE users SET email = ?, name = ?, role = ?, password = ?, company_id = ? WHERE id = ?",
        [email.trim(), name.trim(), nextRole, hashedPassword, companyId, id],
      );
    } else {
      await db.query(
        "UPDATE users SET email = ?, name = ?, role = ?, company_id = ? WHERE id = ?",
        [email.trim(), name.trim(), nextRole, companyId, id],
      );
    }

    res.json({
      success: true,
      user: {
        id: Number(id),
        email: email.trim(),
        name: name.trim(),
        role: nextRole,
        company_id: companyId,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
app.delete("/api/admin/users/:id", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.user.id)) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot delete your own account" });
    }

    let users;
    if (isSuperadmin(req.user)) {
      [users] = await db.query(
        "SELECT id FROM users WHERE id = ? AND role <> 'superadmin'",
        [id],
      );
    } else {
      [users] = await db.query(
        "SELECT id FROM users WHERE id = ? AND company_id = ?",
        [id, req.user.company_id],
      );
    }
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    await db.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user profile (Protected)
app.get("/api/users/me", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, email, name, role, company_id, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = users[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "",
        role: user.role || "user",
        company_id: user.company_id ?? null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update current user profile (Protected)
app.put("/api/users/profile", authenticateToken, async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!/.+@.+\..+/.test(email)) {
      return res.status(400).json({ success: false, error: "Email must be valid" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email.trim(), req.user.id],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    const [currentUsers] = await db.query(
      "SELECT role FROM users WHERE id = ?",
      [req.user.id],
    );
    if (currentUsers.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const currentRole = currentUsers[0].role || "user";

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 6 characters",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        "UPDATE users SET email = ?, name = ?, password = ? WHERE id = ?",
        [email.trim(), name.trim(), hashedPassword, req.user.id],
      );
    } else {
      await db.query("UPDATE users SET email = ?, name = ? WHERE id = ?", [
        email.trim(),
        name.trim(),
        req.user.id,
      ]);
    }

    const user = {
      id: req.user.id,
      email: email.trim(),
      name: name.trim(),
      role: currentRole,
      company_id: req.user.company_id ?? null,
    };

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user name (Protected)
app.put("/api/users/name", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Name is required" });
    }

    await db.query("UPDATE users SET name = ? WHERE id = ?", [
      name.trim(),
      req.user.id,
    ]);

    res.json({
      success: true,
      message: "Name updated successfully",
      name: name.trim(),
    });
  } catch (error) {
    console.error("Error updating user name:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


const findCompanyList = async (listId, companyId, { ownerId = null } = {}) => {
  if (companyId == null) {
    // Superadmin: any list
    if (ownerId != null) {
      const [rows] = await db.query(
        "SELECT id FROM lists WHERE id = ? AND user_id = ?",
        [listId, ownerId],
      );
      return rows;
    }
    const [rows] = await db.query("SELECT id FROM lists WHERE id = ?", [listId]);
    return rows;
  }
  if (ownerId != null) {
    const [rows] = await db.query(
      `SELECT l.id FROM lists l
       INNER JOIN users u ON u.id = l.user_id
       WHERE l.id = ? AND l.user_id = ? AND u.company_id = ?`,
      [listId, ownerId, companyId],
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT l.id FROM lists l
     INNER JOIN users u ON u.id = l.user_id
     WHERE l.id = ? AND u.company_id = ?`,
    [listId, companyId],
  );
  return rows;
};

// Get all lists (Protected)
app.get("/api/lists", authenticateToken, requireCompanyUser, async (req, res) => {
  try {
    const scope = resolveCompanyFilter(req);
    if (scope.error) {
      return res.status(400).json({ success: false, error: scope.error });
    }

    let lists;
    if (canViewAllLists(req.user)) {
      if (scope.companyId == null) {
        [lists] = await db.query(
          `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                  u.email AS owner_email, u.name AS owner_name,
                  u.company_id AS company_id, c.name AS company_name
           FROM lists l
           INNER JOIN users u ON u.id = l.user_id
           LEFT JOIN companies c ON c.id = u.company_id
           WHERE u.company_id IS NOT NULL
           ORDER BY l.created_at DESC`,
        );
      } else {
        [lists] = await db.query(
          `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                  u.email AS owner_email, u.name AS owner_name,
                  u.company_id AS company_id, c.name AS company_name
           FROM lists l
           INNER JOIN users u ON u.id = l.user_id
           LEFT JOIN companies c ON c.id = u.company_id
           WHERE u.company_id = ?
           ORDER BY l.created_at DESC`,
          [scope.companyId],
        );
      }
    } else {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                u.email AS owner_email, u.name AS owner_name,
                u.company_id AS company_id, c.name AS company_name
         FROM lists l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE l.user_id = ?
         ORDER BY l.created_at DESC`,
        [req.user.id],
      );
    }

    const formattedLists = lists.map((list) => ({
      id: list.id,
      name: list.name,
      total: parseFloat(list.total),
      userId: list.user_id,
      ownerEmail: list.owner_email || null,
      ownerName: list.owner_name || null,
      companyId: list.company_id ?? null,
      companyName: list.company_name || null,
      createdAt: list.created_at.toISOString(),
      lastUpdated: list.updated_at.toISOString(),
    }));

    res.json({ success: true, companyId: scope.companyId, lists: formattedLists });
  } catch (error) {
    console.error("Error fetching lists:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific list with entries (Protected)
app.get("/api/lists/:id", authenticateToken, requireCompanyUser, async (req, res) => {
  try {
    const { id } = req.params;

    let lists;
    if (isSuperadmin(req.user)) {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                u.email AS owner_email, u.name AS owner_name,
                u.company_id AS company_id, c.name AS company_name
         FROM lists l
         INNER JOIN users u ON u.id = l.user_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE l.id = ?`,
        [id],
      );
    } else if (canViewAllLists(req.user)) {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                u.email AS owner_email, u.name AS owner_name,
                u.company_id AS company_id, c.name AS company_name
         FROM lists l
         INNER JOIN users u ON u.id = l.user_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE l.id = ? AND u.company_id = ?`,
        [id, req.user.company_id],
      );
    } else {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                NULL AS owner_email, NULL AS owner_name,
                NULL AS company_id, NULL AS company_name
         FROM lists l
         WHERE l.id = ? AND l.user_id = ?`,
        [id, req.user.id],
      );
    }

    if (lists.length === 0) {
      return res.status(404).json({ success: false, error: "List not found" });
    }

    const list = lists[0];

    const [entries] = await db.query(
      "SELECT id, date, category, note, amount, proof_image, created_at FROM entries WHERE list_id = ? ORDER BY created_at ASC",
      [id],
    );

    const formattedEntries = entries.map((entry) => ({
      id: entry.id,
      Date: entry.date.toISOString().split("T")[0],
      Category: entry.category,
      Note: entry.note || "",
      Amount: parseFloat(entry.amount),
      Proof: entry.proof_image ? { url: entry.proof_image } : null,
    }));

    res.json({
      success: true,
      list: {
        id: list.id,
        name: list.name,
        total: parseFloat(list.total),
        userId: list.user_id,
        ownerEmail: list.owner_email || null,
        ownerName: list.owner_name || null,
        companyId: list.company_id ?? null,
        companyName: list.company_name || null,
        entries: formattedEntries,
        createdAt: list.created_at.toISOString(),
        lastUpdated: list.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching list:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new list (Protected)
app.post("/api/lists", authenticateToken, requireCompanyUser, async (req, res) => {
  try {
    if (isManagement(req.user) || isFinance(req.user) || isSuperadmin(req.user)) {
      return res.status(403).json({
        success: false,
        error: "This role cannot create lists",
      });
    }

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "List name is required" });
    }

    const [result] = await db.query(
      "INSERT INTO lists (user_id, name, total) VALUES (?, ?, ?)",
      [req.user.id, name.trim(), 0],
    );

    res.json({
      success: true,
      list: {
        id: result.insertId,
        name: name.trim(),
        total: 0,
      },
    });
  } catch (error) {
    console.error("Error creating list:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a list (Protected)
app.put("/api/lists/:id", authenticateToken, requireCompanyUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, entries, total } = req.body;

    if (isFinance(req.user)) {
      return res.status(403).json({
        success: false,
        error: "Finance users have read-only access",
      });
    }

    // Verify ownership (management/superadmin can access lists in scope)
    let lists;
    if (isSuperadmin(req.user)) {
      lists = await findCompanyList(id, null);
    } else if (isManagement(req.user)) {
      lists = await findCompanyList(id, req.user.company_id);
    } else {
      lists = await findCompanyList(id, req.user.company_id, {
        ownerId: req.user.id,
      });
    }
    if (lists.length === 0)
      return res.status(404).json({ success: false, error: "List not found" });

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update list name if provided
      if (name !== undefined) {
        await connection.query(
          "UPDATE lists SET name = ?, updated_at = NOW() WHERE id = ?",
          [name, id],
        );
      }

      // Update total if provided
      if (total !== undefined) {
        await connection.query(
          "UPDATE lists SET total = ?, updated_at = NOW() WHERE id = ?",
          [total, id],
        );
      }

      // If entries are provided, replace all entries
      if (entries !== undefined && Array.isArray(entries)) {
        // Get existing entry images to delete
        const [existingEntries] = await connection.query(
          "SELECT proof_image FROM entries WHERE list_id = ? AND proof_image IS NOT NULL",
          [id],
        );

        // Delete existing entries
        await connection.query("DELETE FROM entries WHERE list_id = ?", [id]);

        // Delete old image files that are not in the new entries
        const newImageUrls = new Set(
          entries.map((e) => e.Proof?.url).filter((url) => url),
        );

        for (const entry of existingEntries) {
          if (entry.proof_image && !newImageUrls.has(entry.proof_image)) {
            // Only delete if image is not in the new entries
            await deleteImage(entry.proof_image);
          }
        }

        // Insert new entries (ignore entry.id if present, as we're replacing all entries)
        if (entries.length > 0) {
          for (const [index, entry] of entries.entries()) {
            if (!entry.Date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.Date)) {
              throw new Error(
                `Entry ${index + 1}: date is required (YYYY-MM-DD)`,
              );
            }
            if (!entry.Category || !String(entry.Category).trim()) {
              throw new Error(`Entry ${index + 1}: category is required`);
            }
            if (entry.Amount == null || Number.isNaN(Number(entry.Amount))) {
              throw new Error(`Entry ${index + 1}: amount is required`);
            }
          }

          const values = entries.map((entry) => [
            id,
            entry.Date, // Date format: YYYY-MM-DD
            entry.Category,
            entry.Note || null,
            entry.Amount,
            entry.Proof?.url || null,
          ]);

          await connection.query(
            "INSERT INTO entries (list_id, date, category, note, amount, proof_image) VALUES ?",
            [values],
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: "List updated successfully" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating list:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a list (Protected)
app.delete("/api/lists/:id", authenticateToken, requireCompanyUser, async (req, res) => {
  try {
    const { id } = req.params;

    if (isFinance(req.user)) {
      return res.status(403).json({
        success: false,
        error: "Finance users have read-only access",
      });
    }

    // Verify ownership (management/superadmin can delete lists in scope)
    let lists;
    if (isSuperadmin(req.user)) {
      lists = await findCompanyList(id, null);
    } else if (isManagement(req.user)) {
      lists = await findCompanyList(id, req.user.company_id);
    } else {
      lists = await findCompanyList(id, req.user.company_id, {
        ownerId: req.user.id,
      });
    }
    if (lists.length === 0)
      return res.status(404).json({ success: false, error: "List not found" });

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get all entry images to delete
      const [entries] = await connection.query(
        "SELECT proof_image FROM entries WHERE list_id = ? AND proof_image IS NOT NULL",
        [id],
      );

      // Delete entries (cascade will handle this, but we need images first)
      await connection.query("DELETE FROM entries WHERE list_id = ?", [id]);

      // Delete list
      await connection.query("DELETE FROM lists WHERE id = ?", [id]);

      await connection.commit();

      // Delete image files (after transaction commit to ensure DB consistency)
      // Process deletions asynchronously to not block response
      setImmediate(async () => {
        for (const entry of entries) {
          if (entry.proof_image) {
            await deleteImage(entry.proof_image);
          }
        }
      });

      res.json({ success: true, message: "List deleted successfully" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error deleting list:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ---------- Superadmin: companies ----------
app.get(
  "/api/superadmin/companies",
  authenticateToken,
  requireSuperadmin,
  async (_req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT c.id, c.name, c.slug, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS user_count,
                (SELECT COUNT(*) FROM categories cat WHERE cat.company_id = c.id) AS category_count
         FROM companies c
         ORDER BY c.created_at DESC`,
      );
      res.json({
        success: true,
        companies: rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          userCount: Number(row.user_count) || 0,
          categoryCount: Number(row.category_count) || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error("Error listing companies:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.post(
  "/api/superadmin/companies",
  authenticateToken,
  requireSuperadmin,
  async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      let slug = String(req.body.slug || "").trim().toLowerCase();
      if (!name) {
        return res
          .status(400)
          .json({ success: false, error: "Company name is required" });
      }
      if (!slug) slug = slugify(name);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          error: "Slug must be lowercase letters, numbers, and hyphens",
        });
      }

      const [dupes] = await db.query(
        "SELECT id FROM companies WHERE slug = ?",
        [slug],
      );
      if (dupes.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: "Company slug already exists" });
      }

      const [result] = await db.query(
        "INSERT INTO companies (name, slug) VALUES (?, ?)",
        [name, slug],
      );
      await seedCategoriesForCompany(db, result.insertId);

      const [rows] = await db.query(
        "SELECT id, name, slug, created_at, updated_at FROM companies WHERE id = ?",
        [result.insertId],
      );
      res.json({
        success: true,
        company: {
          id: rows[0].id,
          name: rows[0].name,
          slug: rows[0].slug,
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at,
        },
      });
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.get(
  "/api/superadmin/companies/:id",
  authenticateToken,
  requireSuperadmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query(
        "SELECT id, name, slug, created_at, updated_at FROM companies WHERE id = ?",
        [id],
      );
      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Company not found" });
      }
      const [users] = await db.query(
        `SELECT id, email, name, role, created_at
         FROM users WHERE company_id = ?
         ORDER BY role ASC, email ASC`,
        [id],
      );
      res.json({
        success: true,
        company: {
          id: rows[0].id,
          name: rows[0].name,
          slug: rows[0].slug,
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at,
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name || "",
            role: u.role || "user",
            createdAt: u.created_at,
          })),
        },
      });
    } catch (error) {
      console.error("Error getting company:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.put(
  "/api/superadmin/companies/:id",
  authenticateToken,
  requireSuperadmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const name = String(req.body.name || "").trim();
      let slug = String(req.body.slug || "").trim().toLowerCase();

      const [existing] = await db.query(
        "SELECT id FROM companies WHERE id = ?",
        [id],
      );
      if (existing.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Company not found" });
      }
      if (!name) {
        return res
          .status(400)
          .json({ success: false, error: "Company name is required" });
      }
      if (!slug) slug = slugify(name);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          error: "Slug must be lowercase letters, numbers, and hyphens",
        });
      }

      const [dupes] = await db.query(
        "SELECT id FROM companies WHERE slug = ? AND id <> ?",
        [slug, id],
      );
      if (dupes.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: "Company slug already exists" });
      }

      await db.query("UPDATE companies SET name = ?, slug = ? WHERE id = ?", [
        name,
        slug,
        id,
      ]);
      res.json({
        success: true,
        company: { id: Number(id), name, slug },
      });
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.delete(
  "/api/superadmin/companies/:id",
  authenticateToken,
  requireSuperadmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.query(
        "SELECT id, slug FROM companies WHERE id = ?",
        [id],
      );
      if (existing.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Company not found" });
      }
      if (existing[0].slug === "whtb") {
        return res.status(400).json({
          success: false,
          error: "Cannot delete the default WHTB company",
        });
      }

      const [userCount] = await db.query(
        "SELECT COUNT(*) AS c FROM users WHERE company_id = ?",
        [id],
      );
      if (Number(userCount[0]?.c) > 0) {
        return res.status(400).json({
          success: false,
          error: "Company still has users; remove them first",
        });
      }

      await db.query("DELETE FROM categories WHERE company_id = ?", [id]);
      await db.query("DELETE FROM companies WHERE id = ?", [id]);
      res.json({ success: true, message: "Company deleted successfully" });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

app.post(
  "/api/superadmin/companies/:id/bootstrap",
  authenticateToken,
  requireSuperadmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const [companies] = await db.query(
        "SELECT id, name FROM companies WHERE id = ?",
        [id],
      );
      if (companies.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Company not found" });
      }

      const management = req.body.management || {};
      const finance = req.body.finance || {};
      const created = [];

      async function upsertRoleUser(payload, role) {
        const email = String(payload.email || "").trim();
        const password = String(payload.password || "");
        const name = String(payload.name || "").trim();
        if (!email || !password) {
          throw new Error(`${role} email and password are required`);
        }
        if (!/.+@.+\..+/.test(email)) {
          throw new Error(`${role} email must be valid`);
        }
        if (password.length < 6) {
          throw new Error(`${role} password must be at least 6 characters`);
        }

        const [existing] = await db.query(
          "SELECT id, company_id, role FROM users WHERE email = ?",
          [email],
        );
        const hashedPassword = await bcrypt.hash(password, 10);

        if (existing.length > 0) {
          if (
            existing[0].company_id &&
            Number(existing[0].company_id) !== Number(id)
          ) {
            throw new Error(
              `${email} already belongs to another company`,
            );
          }
          if (existing[0].role === "superadmin") {
            throw new Error(`${email} is a superadmin and cannot be reassigned`);
          }
          await db.query(
            `UPDATE users
             SET password = ?, name = ?, role = ?, company_id = ?
             WHERE id = ?`,
            [hashedPassword, name || role, role, id, existing[0].id],
          );
          created.push({
            id: existing[0].id,
            email,
            name: name || role,
            role,
            updated: true,
          });
          return;
        }

        const [result] = await db.query(
          `INSERT INTO users (email, password, name, role, company_id)
           VALUES (?, ?, ?, ?, ?)`,
          [email, hashedPassword, name || role, role, id],
        );
        created.push({
          id: result.insertId,
          email,
          name: name || role,
          role,
          updated: false,
        });
      }

      await upsertRoleUser(management, "management");
      await upsertRoleUser(finance, "finance");
      await seedCategoriesForCompany(db, Number(id));

      res.json({
        success: true,
        companyId: Number(id),
        users: created,
      });
    } catch (error) {
      console.error("Error bootstrapping company:", error);
      const status = /required|valid|another company|superadmin/i.test(
        error.message || "",
      )
        ? 400
        : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  },
);

// Parse receipt via OCR.space and suggest form fields
app.post(
  "/api/parse-receipt",
  authenticateToken,
  requireCompanyUser,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No image file provided" });
      }
      if (!process.env.OCR_SPACE_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "Receipt OCR is not configured",
        });
      }

      const { parseReceipt } = require("./utils/receiptOcr");
      const { categoryValue } = require("./database/categories");

      let categories = [];
      const companyId = isSuperadmin(req.user)
        ? Number(req.query.companyId || req.body?.companyId) || null
        : req.user.company_id;

      if (companyId) {
        const [rows] = await db.query(
          `SELECT name_id, name_zh FROM categories
           WHERE company_id = ?
           ORDER BY sort_order ASC, id ASC`,
          [companyId],
        );
        categories = rows.map((row) => ({
          name_id: row.name_id,
          name_zh: row.name_zh,
          value: categoryValue(row.name_id, row.name_zh),
        }));
      }

      const parsed = await parseReceipt(req.file.buffer, {
        filename: req.file.originalname || "receipt.jpg",
        categories,
      });

      res.json({
        success: true,
        fields: {
          date: parsed.date,
          amount: parsed.amount,
          currency: parsed.currency || "IDR",
          note: parsed.note || "",
          category: parsed.category || "",
        },
        confidence: parsed.confidence,
        rawText: parsed.text,
      });
    } catch (error) {
      console.error("Error parsing receipt:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to parse receipt",
      });
    }
  },
);

// Upload image
app.post("/api/upload-image", authenticateToken, requireCompanyUser, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No image file provided" });
    }

    // Compress and save image
    const result = await compressAndSaveImage(
      req.file.buffer,
      req.file.originalname,
    );

    res.json({
      success: true,
      url: result.url,
      filename: result.filename,
      size: result.size,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update an entry
app.put(
  "/api/entries/:id",
  authenticateToken,
  requireCompanyUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { Date: date, Category, Note, Amount, Proof } = req.body;

      if (isFinance(req.user)) {
        return res.status(403).json({
          success: false,
          error: "Finance users have read-only access",
        });
      }

      const [rows] = await db.query(
        `SELECT e.id, e.list_id, e.proof_image, e.amount, l.user_id, u.company_id
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         WHERE e.id = ?`,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Entry not found" });
      }

      const entry = rows[0];
      if (
        !isSuperadmin(req.user) &&
        Number(entry.company_id) !== Number(req.user.company_id)
      ) {
        return res.status(404).json({ success: false, error: "Entry not found" });
      }
      if (
        !isSuperadmin(req.user) &&
        !isManagement(req.user) &&
        Number(entry.user_id) !== Number(req.user.id)
      ) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: "date is required (YYYY-MM-DD)",
        });
      }
      if (!Category || !String(Category).trim()) {
        return res
          .status(400)
          .json({ success: false, error: "category is required" });
      }
      if (Amount == null || Number.isNaN(Number(Amount))) {
        return res
          .status(400)
          .json({ success: false, error: "amount is required" });
      }

      const nextAmount = Number(Amount);
      const nextProof =
        Proof && typeof Proof === "object" && Proof.url
          ? Proof.url
          : typeof Proof === "string"
            ? Proof
            : Proof === null
              ? null
              : entry.proof_image;

      await db.query(
        `UPDATE entries
         SET date = ?, category = ?, note = ?, amount = ?, proof_image = ?
         WHERE id = ?`,
        [
          date,
          String(Category).trim(),
          Note != null ? String(Note) : null,
          nextAmount,
          nextProof,
          id,
        ],
      );

      if (
        entry.proof_image &&
        nextProof &&
        entry.proof_image !== nextProof
      ) {
        await deleteImage(entry.proof_image);
      } else if (entry.proof_image && nextProof === null) {
        await deleteImage(entry.proof_image);
      }

      // Recalculate list total
      const [sumRows] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM entries WHERE list_id = ?",
        [entry.list_id],
      );
      const listTotal = parseFloat(sumRows[0].total) || 0;
      await db.query(
        "UPDATE lists SET total = ?, updated_at = NOW() WHERE id = ?",
        [listTotal, entry.list_id],
      );

      res.json({
        success: true,
        entry: {
          id: Number(id),
          Date: date,
          Category: String(Category).trim(),
          Note: Note != null ? String(Note) : "",
          Amount: nextAmount,
          Proof: nextProof ? { url: nextProof } : null,
        },
        listTotal,
      });
    } catch (error) {
      console.error("Error updating entry:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Delete an entry (helper endpoint)
app.delete(
  "/api/entries/:id",
  authenticateToken,
  requireCompanyUser,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [entries] = await db.query(
        `SELECT e.id, e.proof_image, l.user_id, u.company_id
         FROM entries e
         INNER JOIN lists l ON l.id = e.list_id
         INNER JOIN users u ON u.id = l.user_id
         WHERE e.id = ?`,
        [id],
      );

      if (entries.length === 0) {
        return res.status(404).json({ success: false, error: "Entry not found" });
      }

      const entry = entries[0];
      if (
        !isSuperadmin(req.user) &&
        Number(entry.company_id) !== Number(req.user.company_id)
      ) {
        return res.status(404).json({ success: false, error: "Entry not found" });
      }
      if (
        !isSuperadmin(req.user) &&
        !isManagement(req.user) &&
        Number(entry.user_id) !== Number(req.user.id)
      ) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      if (isFinance(req.user)) {
        return res.status(403).json({
          success: false,
          error: "Finance users have read-only access",
        });
      }

      await db.query("DELETE FROM entries WHERE id = ?", [id]);

      if (entry.proof_image) {
        await deleteImage(entry.proof_image);
      }

      res.json({ success: true, message: "Entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting entry:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Apply schema migrations + system user seeds on startup (idempotent)
async function setupDatabaseOnStartup() {
  try {
    const setup = require("./database/setup");
    const runSeed = !["0", "false", "no"].includes(
      String(process.env.RUN_SEEDS || "true").toLowerCase(),
    );
    await setup({ db, runSeed });
  } catch (error) {
    console.error("⚠️  Database setup failed:", error.message);
    console.error("   Run manually: npm run db:setup");
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Images served from: ${path.join(__dirname, "public", "images")}`,
  );
  await setupDatabaseOnStartup();
});
