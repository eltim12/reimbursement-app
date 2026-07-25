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
        "SELECT id, email, role FROM users WHERE id = ?",
        [decoded.id],
      );
      if (users.length === 0) {
        return res.status(403).json({ success: false, error: "Invalid token" });
      }
      req.user = {
        id: users[0].id,
        email: users[0].email,
        role: users[0].role || "user",
      };
      next();
    } catch (error) {
      console.error("Auth lookup error:", error);
      return res.status(500).json({ success: false, error: "Auth failed" });
    }
  });
};

const requireManagement = (req, res, next) => {
  if (req.user?.role !== "management") {
    return res.status(403).json({ success: false, error: "Management access required" });
  }
  next();
};

const ALLOWED_ROLES = ["user", "admin", "management", "finance"];
const isManagement = (user) => user?.role === "management";
const isFinance = (user) => user?.role === "finance";
const canViewAllLists = (user) => isManagement(user) || isFinance(user);

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Reimbursement API is running" });
});

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required" });
    }

    // Check if user exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name || "", "user"],
    );

    res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
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

    // Generate Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Management: list all users
app.get("/api/admin/users", authenticateToken, requireManagement, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC",
    );

    res.json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name || "",
        role: user.role || "user",
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Management: create user
app.post("/api/admin/users", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

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
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
      [email.trim(), hashedPassword, (name || "").trim(), nextRole],
    );

    res.json({
      success: true,
      user: {
        id: result.insertId,
        email: email.trim(),
        name: (name || "").trim(),
        role: nextRole,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Management: update user
app.put("/api/admin/users/:id", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, role } = req.body;

    const [users] = await db.query("SELECT id, role FROM users WHERE id = ?", [id]);
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

    const nextRole = ALLOWED_ROLES.includes(role) ? role : users[0].role || "user";

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
        "UPDATE users SET email = ?, name = ?, role = ?, password = ? WHERE id = ?",
        [email.trim(), name.trim(), nextRole, hashedPassword, id],
      );
    } else {
      await db.query(
        "UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?",
        [email.trim(), name.trim(), nextRole, id],
      );
    }

    res.json({
      success: true,
      user: {
        id: Number(id),
        email: email.trim(),
        name: name.trim(),
        role: nextRole,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Management: delete user
app.delete("/api/admin/users/:id", authenticateToken, requireManagement, async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.user.id)) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot delete your own account" });
    }

    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [id]);
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
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
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

// Get all lists (Protected)
app.get("/api/lists", authenticateToken, async (req, res) => {
  try {
    let lists;
    if (canViewAllLists(req.user)) {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                u.email AS owner_email, u.name AS owner_name
         FROM lists l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.created_at DESC`,
      );
    } else {
      [lists] = await db.query(
        "SELECT id, name, total, created_at, updated_at, user_id FROM lists WHERE user_id = ? ORDER BY created_at DESC",
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
      createdAt: list.created_at.toISOString(),
      lastUpdated: list.updated_at.toISOString(),
    }));

    res.json({ success: true, lists: formattedLists });
  } catch (error) {
    console.error("Error fetching lists:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific list with entries (Protected)
app.get("/api/lists/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    let lists;
    if (canViewAllLists(req.user)) {
      [lists] = await db.query(
        `SELECT l.id, l.name, l.total, l.created_at, l.updated_at, l.user_id,
                u.email AS owner_email, u.name AS owner_name
         FROM lists l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.id = ?`,
        [id],
      );
    } else {
      [lists] = await db.query(
        "SELECT id, name, total, created_at, updated_at, user_id FROM lists WHERE id = ? AND user_id = ?",
        [id, req.user.id],
      );
    }

    if (lists.length === 0) {
      return res.status(404).json({ success: false, error: "List not found" });
    }

    const list = lists[0];

    // Get entries
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
app.post("/api/lists", authenticateToken, async (req, res) => {
  try {
    if (isManagement(req.user) || isFinance(req.user)) {
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
app.put("/api/lists/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, entries, total } = req.body;

    if (isFinance(req.user)) {
      return res.status(403).json({
        success: false,
        error: "Finance users have read-only access",
      });
    }

    // Verify ownership (management can access any list)
    const [lists] = await db.query(
      isManagement(req.user)
        ? "SELECT id FROM lists WHERE id = ?"
        : "SELECT id FROM lists WHERE id = ? AND user_id = ?",
      isManagement(req.user) ? [id] : [id, req.user.id],
    );
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
app.delete("/api/lists/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (isFinance(req.user)) {
      return res.status(403).json({
        success: false,
        error: "Finance users have read-only access",
      });
    }

    // Verify ownership (management can delete any list)
    const [lists] = await db.query(
      isManagement(req.user)
        ? "SELECT id FROM lists WHERE id = ?"
        : "SELECT id FROM lists WHERE id = ? AND user_id = ?",
      isManagement(req.user) ? [id] : [id, req.user.id],
    );
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

// Upload image
app.post("/api/upload-image", upload.single("image"), async (req, res) => {
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

// Delete an entry (helper endpoint)
app.delete("/api/entries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get entry to find image
    const [entries] = await db.query(
      "SELECT proof_image FROM entries WHERE id = ?",
      [id],
    );

    if (entries.length === 0) {
      return res.status(404).json({ success: false, error: "Entry not found" });
    }

    // Delete entry
    await db.query("DELETE FROM entries WHERE id = ?", [id]);

    // Delete image if exists
    if (entries[0].proof_image) {
      await deleteImage(entries[0].proof_image);
    }

    res.json({ success: true, message: "Entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting entry:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify database tables exist on startup
async function verifyDatabase() {
  try {
    const [tables] = await db.query("SHOW TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);

    if (!tableNames.includes("lists") || !tableNames.includes("entries")) {
      console.warn(
        "⚠️  Warning: Database tables may not exist. Run: npm run init-db",
      );
    } else {
      console.log("✓ Database tables verified");
    }

    if (tableNames.includes("users")) {
      const [columns] = await db.query("DESCRIBE users");
      if (!columns.some((col) => col.Field === "role")) {
        await db.query(
          "ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user' AFTER name",
        );
        console.log("✓ Added users.role column");
      }
    }
  } catch (error) {
    console.error("⚠️  Database verification failed:", error.message);
    console.error(
      "   Please ensure the database is initialized: npm run init-db",
    );
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Images served from: ${path.join(__dirname, "public", "images")}`,
  );
  await verifyDatabase();
});
