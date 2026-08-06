/**
 * Purchasing request routes.
 * Wired from server.js with shared auth helpers + db.
 */
module.exports = function registerPurchasingRoutes({
  app,
  db,
  authenticateToken,
  requireCompanyUser,
  resolveCompanyFilter,
  isSuperadmin,
  isManagement,
  isFinance,
}) {
  const STATUSES = ["pending", "approved", "ordered", "received", "rejected"];
  const URGENCIES = ["low", "medium", "high"];
  const CATEGORIES = ["office", "production"];

  const canFullEditPurchasing = (user) => {
    if (isSuperadmin(user)) return true;
    if (!user?.company_id) return false;
    if (isFinance(user) || isManagement(user)) return true;
    return !!user.purchasing_editor;
  };

  const mapPurchasingRow = (row) => {
    const formatDateTime = (value) => {
      if (!value) return null;
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) {
        const raw = String(value);
        // MySQL DATETIME string "YYYY-MM-DD HH:MM:SS"
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
          return raw.slice(0, 16).replace("T", " ");
        }
        return raw;
      }
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return {
      id: row.id,
      company_id: row.company_id,
      company_name: row.company_name || null,
      requestor_id: row.requestor_id,
      requestor_name: row.requestor_name || "",
      requestor_email: row.requestor_email || "",
      item_name: row.item_name,
      quantity: Number(row.quantity),
      note: row.note || "",
      picture: row.picture || null,
      urgency: row.urgency,
      status: row.status,
      category: row.category,
      request_date: formatDateTime(row.request_date),
      received_proof_image: row.received_proof_image || null,
      received_note: row.received_note || "",
      received_at: row.received_at || null,
      status_updated_at: row.status_updated_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  };

  async function assertCompanyPurchasingEnabled(companyId) {
    const [rows] = await db.query(
      "SELECT purchasing_enabled FROM companies WHERE id = ?",
      [companyId],
    );
    if (rows.length === 0) {
      return { ok: false, status: 404, error: "Company not found" };
    }
    if (!rows[0].purchasing_enabled) {
      return {
        ok: false,
        status: 403,
        error: "Purchasing feature is disabled for this company",
      };
    }
    return { ok: true };
  }

  async function loadRequest(id) {
    const [rows] = await db.query(
      `SELECT p.*,
              u.name AS requestor_name,
              u.email AS requestor_email,
              c.name AS company_name
       FROM purchasing_requests p
       LEFT JOIN users u ON u.id = p.requestor_id
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  // List (company-wide when feature on)
  app.get(
    "/api/purchasing",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const scope = resolveCompanyFilter(req);
        if (scope.error) {
          return res.status(400).json({ success: false, error: scope.error });
        }

        if (scope.companyId != null) {
          if (!isSuperadmin(req.user)) {
            const gate = await assertCompanyPurchasingEnabled(scope.companyId);
            if (!gate.ok) {
              return res
                .status(gate.status)
                .json({ success: false, error: gate.error });
            }
          } else {
            // Superadmin listing a specific company: still allow even if off (empty ok)
          }
        } else if (!isSuperadmin(req.user)) {
          return res
            .status(400)
            .json({ success: false, error: "Company membership required" });
        }

        const {
          search,
          category,
          urgency,
          status,
          requestorId,
          dateFrom,
          dateTo,
        } = req.query;

        const where = [];
        const params = [];

        if (scope.companyId != null) {
          where.push("p.company_id = ?");
          params.push(scope.companyId);
        } else {
          // Superadmin all: only companies with feature enabled
          where.push("c.purchasing_enabled = 1");
        }

        if (category && CATEGORIES.includes(category)) {
          where.push("p.category = ?");
          params.push(category);
        }
        if (urgency && URGENCIES.includes(urgency)) {
          where.push("p.urgency = ?");
          params.push(urgency);
        }
        if (status && STATUSES.includes(status)) {
          where.push("p.status = ?");
          params.push(status);
        }
        if (requestorId) {
          where.push("p.requestor_id = ?");
          params.push(Number(requestorId));
        }
        if (dateFrom) {
          where.push("DATE(p.request_date) >= ?");
          params.push(String(dateFrom).slice(0, 10));
        }
        if (dateTo) {
          where.push("DATE(p.request_date) <= ?");
          params.push(String(dateTo).slice(0, 10));
        }
        if (search && String(search).trim()) {
          where.push(
            "(p.item_name LIKE ? OR p.note LIKE ? OR u.name LIKE ? OR u.email LIKE ?)",
          );
          const q = `%${String(search).trim()}%`;
          params.push(q, q, q, q);
        }

        const sql = `
          SELECT p.*,
                 u.name AS requestor_name,
                 u.email AS requestor_email,
                 c.name AS company_name
          FROM purchasing_requests p
          LEFT JOIN users u ON u.id = p.requestor_id
          LEFT JOIN companies c ON c.id = p.company_id
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY p.request_date DESC, p.id DESC
        `;

        const [rows] = await db.query(sql, params);
        res.json({
          success: true,
          companyId: scope.companyId,
          canFullEdit: canFullEditPurchasing(req.user),
          requests: rows.map(mapPurchasingRow),
        });
      } catch (error) {
        console.error("Error listing purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Create
  app.post(
    "/api/purchasing",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const scope = resolveCompanyFilter(req, { required: true });
        if (scope.error) {
          return res.status(400).json({ success: false, error: scope.error });
        }

        const gate = await assertCompanyPurchasingEnabled(scope.companyId);
        if (!gate.ok) {
          return res
            .status(gate.status)
            .json({ success: false, error: gate.error });
        }

        const item_name = String(req.body.item_name || "").trim();
        const quantity = Number(req.body.quantity);
        const note = String(req.body.note || "").trim();
        const picture = req.body.picture ? String(req.body.picture) : null;
        const urgency = URGENCIES.includes(req.body.urgency)
          ? req.body.urgency
          : "medium";
        const category = req.body.category;

        if (!item_name) {
          return res
            .status(400)
            .json({ success: false, error: "Item name is required" });
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return res
            .status(400)
            .json({ success: false, error: "Quantity must be greater than 0" });
        }
        if (!CATEGORIES.includes(category)) {
          return res.status(400).json({
            success: false,
            error: "Category must be office or production",
          });
        }

        const requestorId = isSuperadmin(req.user)
          ? Number(req.body.requestor_id) || req.user.id
          : req.user.id;

        const [result] = await db.query(
          `INSERT INTO purchasing_requests
            (company_id, requestor_id, item_name, quantity, note, picture,
             urgency, status, category, request_date, status_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
          [
            scope.companyId,
            requestorId,
            item_name,
            quantity,
            note || null,
            picture,
            urgency,
            category,
          ],
        );

        const row = await loadRequest(result.insertId);
        res.json({ success: true, request: mapPurchasingRow(row) });
      } catch (error) {
        console.error("Error creating purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Update
  app.put(
    "/api/purchasing/:id",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const row = await loadRequest(req.params.id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, error: "Purchasing request not found" });
        }

        if (!isSuperadmin(req.user) && row.company_id !== req.user.company_id) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        const gate = await assertCompanyPurchasingEnabled(row.company_id);
        if (!gate.ok && !isSuperadmin(req.user)) {
          return res
            .status(gate.status)
            .json({ success: false, error: gate.error });
        }

        const fullEdit = canFullEditPurchasing(req.user);
        const isOwnerPending =
          row.requestor_id === req.user.id && row.status === "pending";

        if (!fullEdit && !isOwnerPending) {
          return res.status(403).json({
            success: false,
            error: "Not allowed to edit this purchasing request",
          });
        }

        const item_name = String(
          req.body.item_name != null ? req.body.item_name : row.item_name,
        ).trim();
        const quantity = Number(
          req.body.quantity != null ? req.body.quantity : row.quantity,
        );
        const note =
          req.body.note != null
            ? String(req.body.note).trim()
            : row.note || "";
        const picture =
          req.body.picture !== undefined
            ? req.body.picture
              ? String(req.body.picture)
              : null
            : row.picture;
        const urgency = URGENCIES.includes(req.body.urgency)
          ? req.body.urgency
          : row.urgency;
        const category = CATEGORIES.includes(req.body.category)
          ? req.body.category
          : row.category;

        if (!item_name) {
          return res
            .status(400)
            .json({ success: false, error: "Item name is required" });
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return res
            .status(400)
            .json({ success: false, error: "Quantity must be greater than 0" });
        }

        let status = row.status;
        let received_proof_image = row.received_proof_image;
        let received_note = row.received_note || "";
        let received_at = row.received_at;
        let status_updated_at = row.status_updated_at;

        if (fullEdit) {
          if (req.body.status != null) {
            if (!STATUSES.includes(req.body.status)) {
              return res
                .status(400)
                .json({ success: false, error: "Invalid status" });
            }
            status = req.body.status;
          }

          if (req.body.received_proof_image !== undefined) {
            received_proof_image = req.body.received_proof_image
              ? String(req.body.received_proof_image)
              : null;
          }
          if (req.body.received_note !== undefined) {
            received_note = String(req.body.received_note || "").trim();
          }

          if (status === "received") {
            if (!received_proof_image) {
              return res.status(400).json({
                success: false,
                error: "Received proof image is required when status is received",
              });
            }
            if (!received_note) {
              return res.status(400).json({
                success: false,
                error:
                  "Received note (receiver or supplier) is required when status is received",
              });
            }
            if (row.status !== "received" || !received_at) {
              received_at = new Date();
            }
          } else if (row.status === "received" && status !== "received") {
            // Leaving received — keep historical proof/note/at for audit
          }

          if (status !== row.status) {
            status_updated_at = new Date();
          }
        }

        await db.query(
          `UPDATE purchasing_requests SET
            item_name = ?, quantity = ?, note = ?, picture = ?,
            urgency = ?, category = ?,
            status = ?, received_proof_image = ?, received_note = ?,
            received_at = ?, status_updated_at = ?
           WHERE id = ?`,
          [
            item_name,
            quantity,
            note || null,
            picture,
            urgency,
            category,
            status,
            received_proof_image,
            received_note || null,
            received_at,
            status_updated_at,
            row.id,
          ],
        );

        const updated = await loadRequest(row.id);
        res.json({ success: true, request: mapPurchasingRow(updated) });
      } catch (error) {
        console.error("Error updating purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Delete
  app.delete(
    "/api/purchasing/:id",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const row = await loadRequest(req.params.id);
        if (!row) {
          return res
            .status(404)
            .json({ success: false, error: "Purchasing request not found" });
        }

        if (!isSuperadmin(req.user) && row.company_id !== req.user.company_id) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        const fullEdit = canFullEditPurchasing(req.user);
        const isOwnerPending =
          row.requestor_id === req.user.id && row.status === "pending";

        if (!fullEdit && !isOwnerPending) {
          return res.status(403).json({
            success: false,
            error: "Not allowed to delete this purchasing request",
          });
        }

        await db.query("DELETE FROM purchasing_requests WHERE id = ?", [
          row.id,
        ]);
        res.json({ success: true, message: "Deleted" });
      } catch (error) {
        console.error("Error deleting purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );
};
