/**
 * Purchasing order routes (PO with multi-items).
 * Status can be set for the whole PO or per item (multi-supplier).
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
  const ITEM_STATUSES = [
    "pending",
    "approved",
    "ordered",
    "received",
    "rejected",
  ];
  const ORDER_STATUSES = [...ITEM_STATUSES, "partial"];
  const URGENCIES = ["low", "medium", "high"];
  const CATEGORIES = ["office", "production"];

  const canFullEditPurchasing = (user) => {
    if (isSuperadmin(user)) return true;
    if (!user?.company_id) return false;
    if (isFinance(user) || isManagement(user)) return true;
    return !!user.purchasing_editor;
  };

  const formatDateTime = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      const raw = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 16).replace("T", " ");
      }
      return raw;
    }
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const deriveOrderStatus = (items) => {
    const statuses = (items || [])
      .map((i) => i.status)
      .filter((s) => ITEM_STATUSES.includes(s));
    if (!statuses.length) return "pending";
    const unique = [...new Set(statuses)];
    if (unique.length === 1) return unique[0];
    return "partial";
  };

  const mapItem = (row) => ({
    id: row.id,
    order_id: row.order_id,
    item_name: row.item_name,
    quantity: Number(row.quantity),
    unit: row.unit || "pcs",
    note: row.note || "",
    picture: row.picture || null,
    category: row.category,
    status: row.status || "pending",
    supplier: row.supplier || "",
    received_proof_image: row.received_proof_image || null,
    received_note: row.received_note || "",
    received_at: row.received_at || null,
    sort_order: Number(row.sort_order) || 0,
  });

  const mapOrder = (row, items = []) => {
    const mappedItems = items.map(mapItem);
    return {
      id: row.id,
      company_id: row.company_id,
      company_name: row.company_name || null,
      requestor_id: row.requestor_id,
      requestor_name: row.requestor_name || "",
      requestor_email: row.requestor_email || "",
      created_by_id: row.created_by_id,
      created_by_name: row.created_by_name || "",
      created_by_email: row.created_by_email || "",
      po_code: row.po_code,
      urgency: row.urgency,
      status: deriveOrderStatus(mappedItems),
      note: row.note || "",
      request_date: formatDateTime(row.request_date),
      received_proof_image: row.received_proof_image || null,
      received_note: row.received_note || "",
      received_at: row.received_at || null,
      status_updated_at: row.status_updated_at || null,
      item_count: mappedItems.length,
      items: mappedItems,
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

  async function generatePoCode(companyId) {
    const [companies] = await db.query(
      "SELECT slug FROM companies WHERE id = ?",
      [companyId],
    );
    const slug = String(companies[0]?.slug || "PO")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "");
    const prefix = `${slug || "PO"}-PO-`;

    const [rows] = await db.query(
      `SELECT po_code FROM purchasing_orders
       WHERE company_id = ? AND po_code LIKE ?
       ORDER BY id DESC`,
      [companyId, `${prefix}%`],
    );

    let maxSeq = 0;
    for (const row of rows) {
      const code = String(row.po_code || "");
      if (!code.startsWith(prefix)) continue;
      const numPart = code.slice(prefix.length);
      const n = parseInt(numPart, 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }

    return `${prefix}${maxSeq + 1}`;
  }

  async function loadItems(orderId) {
    const [rows] = await db.query(
      `SELECT * FROM purchasing_order_items
       WHERE order_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [orderId],
    );
    return rows;
  }

  async function loadOrder(id) {
    const [rows] = await db.query(
      `SELECT o.*,
              r.name AS requestor_name,
              r.email AS requestor_email,
              cb.name AS created_by_name,
              cb.email AS created_by_email,
              c.name AS company_name
       FROM purchasing_orders o
       LEFT JOIN users r ON r.id = o.requestor_id
       LEFT JOIN users cb ON cb.id = o.created_by_id
       LEFT JOIN companies c ON c.id = o.company_id
       WHERE o.id = ?`,
      [id],
    );
    if (!rows[0]) return null;
    const items = await loadItems(id);
    return mapOrder(rows[0], items);
  }

  async function syncOrderStatus(orderId) {
    const items = await loadItems(orderId);
    const status = deriveOrderStatus(items.map(mapItem));
    await db.query(
      `UPDATE purchasing_orders
       SET status = ?, status_updated_at = NOW()
       WHERE id = ?`,
      [status, orderId],
    );
    return status;
  }

  function validateReceivedFields(status, proof, note, label) {
    if (status !== "received") return null;
    if (!proof) {
      return `${label}: received proof image is required`;
    }
    if (!String(note || "").trim()) {
      return `${label}: received note (receiver or supplier) is required`;
    }
    return null;
  }

  function normalizeItems(rawItems, { forCreate = false } = {}) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return { error: "At least one item is required" };
    }

    const items = [];
    for (let i = 0; i < rawItems.length; i += 1) {
      const raw = rawItems[i] || {};
      const item_name = String(raw.item_name || "").trim();
      const quantity = Number(raw.quantity);
      const unit = String(raw.unit || "pcs").trim() || "pcs";
      const note = String(raw.note || "").trim();
      const picture = raw.picture ? String(raw.picture) : null;
      const category = raw.category;
      const supplier = String(raw.supplier || "").trim();
      const status = ITEM_STATUSES.includes(raw.status)
        ? raw.status
        : "pending";
      const received_proof_image = raw.received_proof_image
        ? String(raw.received_proof_image)
        : null;
      const received_note = String(raw.received_note || "").trim();

      if (!item_name) {
        return { error: `Item #${i + 1}: name is required` };
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { error: `Item #${i + 1}: quantity must be greater than 0` };
      }
      if (!CATEGORIES.includes(category)) {
        return {
          error: `Item #${i + 1}: category must be office or production`,
        };
      }

      if (!forCreate) {
        const err = validateReceivedFields(
          status,
          received_proof_image,
          received_note,
          `Item #${i + 1}`,
        );
        if (err) return { error: err };
      }

      items.push({
        id: raw.id != null ? Number(raw.id) : null,
        item_name,
        quantity,
        unit,
        note: note || null,
        picture,
        category,
        supplier: supplier || null,
        status: forCreate ? "pending" : status,
        received_proof_image: forCreate ? null : received_proof_image,
        received_note: forCreate ? null : received_note || null,
        received_at:
          !forCreate && status === "received" ? raw.received_at || new Date() : null,
        sort_order: i,
      });
    }
    return { items };
  }

  async function upsertOrderItems(orderId, items) {
    const [existing] = await db.query(
      "SELECT id FROM purchasing_order_items WHERE order_id = ?",
      [orderId],
    );
    const existingIds = new Set(existing.map((r) => r.id));
    const keepIds = new Set();

    for (const item of items) {
      const received_at =
        item.status === "received"
          ? item.received_at || new Date()
          : null;

      if (item.id && existingIds.has(item.id)) {
        keepIds.add(item.id);
        await db.query(
          `UPDATE purchasing_order_items SET
            item_name = ?, quantity = ?, unit = ?, note = ?, picture = ?,
            category = ?, status = ?, supplier = ?,
            received_proof_image = ?, received_note = ?, received_at = ?,
            sort_order = ?
           WHERE id = ? AND order_id = ?`,
          [
            item.item_name,
            item.quantity,
            item.unit,
            item.note,
            item.picture,
            item.category,
            item.status,
            item.supplier,
            item.received_proof_image,
            item.received_note,
            received_at,
            item.sort_order,
            item.id,
            orderId,
          ],
        );
      } else {
        const [ins] = await db.query(
          `INSERT INTO purchasing_order_items
            (order_id, item_name, quantity, unit, note, picture, category,
             status, supplier, received_proof_image, received_note, received_at,
             sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.item_name,
            item.quantity,
            item.unit,
            item.note,
            item.picture,
            item.category,
            item.status,
            item.supplier,
            item.received_proof_image,
            item.received_note,
            received_at,
            item.sort_order,
          ],
        );
        keepIds.add(ins.insertId);
      }
    }

    for (const id of existingIds) {
      if (!keepIds.has(id)) {
        await db.query(
          "DELETE FROM purchasing_order_items WHERE id = ? AND order_id = ?",
          [id, orderId],
        );
      }
    }
  }

  async function resolveRequestorId(req, companyId, bodyRequestorId) {
    if (bodyRequestorId == null || bodyRequestorId === "") {
      return req.user.id;
    }
    const id = Number(bodyRequestorId);
    if (!Number.isFinite(id)) return req.user.id;

    const [rows] = await db.query(
      `SELECT id, company_id, role FROM users WHERE id = ?`,
      [id],
    );
    if (!rows[0]) {
      return { error: "Requestor not found" };
    }
    if (rows[0].role === "superadmin") {
      return { error: "Invalid requestor" };
    }
    if (!isSuperadmin(req.user) && rows[0].company_id !== companyId) {
      return { error: "Requestor must belong to the same company" };
    }
    if (
      isSuperadmin(req.user) &&
      rows[0].company_id != null &&
      rows[0].company_id !== companyId
    ) {
      return { error: "Requestor must belong to the selected company" };
    }
    return id;
  }

  // Company colleagues for requestor combobox
  app.get(
    "/api/purchasing/colleagues",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const scope = resolveCompanyFilter(req, { required: true });
        if (scope.error) {
          return res.status(400).json({ success: false, error: scope.error });
        }

        const [rows] = await db.query(
          `SELECT id, name, email, role
           FROM users
           WHERE company_id = ? AND role <> 'superadmin'
           ORDER BY name ASC, email ASC`,
          [scope.companyId],
        );

        res.json({
          success: true,
          colleagues: rows.map((u) => ({
            id: u.id,
            name: u.name || "",
            email: u.email,
            role: u.role,
          })),
        });
      } catch (error) {
        console.error("Error listing purchasing colleagues:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // List POs
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
          where.push("o.company_id = ?");
          params.push(scope.companyId);
        } else {
          where.push("c.purchasing_enabled = 1");
        }

        if (urgency && URGENCIES.includes(urgency)) {
          where.push("o.urgency = ?");
          params.push(urgency);
        }
        if (status && ORDER_STATUSES.includes(status)) {
          if (status === "partial") {
            where.push("o.status = ?");
            params.push("partial");
          } else {
            where.push("o.status = ?");
            params.push(status);
          }
        }
        if (requestorId) {
          where.push("o.requestor_id = ?");
          params.push(Number(requestorId));
        }
        if (dateFrom) {
          where.push("DATE(o.request_date) >= ?");
          params.push(String(dateFrom).slice(0, 10));
        }
        if (dateTo) {
          where.push("DATE(o.request_date) <= ?");
          params.push(String(dateTo).slice(0, 10));
        }
        if (category && CATEGORIES.includes(category)) {
          where.push(
            `EXISTS (
              SELECT 1 FROM purchasing_order_items poi
              WHERE poi.order_id = o.id AND poi.category = ?
            )`,
          );
          params.push(category);
        }
        if (search && String(search).trim()) {
          where.push(
            `(o.po_code LIKE ? OR o.note LIKE ? OR r.name LIKE ? OR r.email LIKE ?
              OR EXISTS (
                SELECT 1 FROM purchasing_order_items poi
                WHERE poi.order_id = o.id
                  AND (poi.item_name LIKE ? OR poi.note LIKE ? OR poi.supplier LIKE ?)
              ))`,
          );
          const q = `%${String(search).trim()}%`;
          params.push(q, q, q, q, q, q, q);
        }

        const sql = `
          SELECT o.*,
                 r.name AS requestor_name,
                 r.email AS requestor_email,
                 cb.name AS created_by_name,
                 cb.email AS created_by_email,
                 c.name AS company_name
          FROM purchasing_orders o
          LEFT JOIN users r ON r.id = o.requestor_id
          LEFT JOIN users cb ON cb.id = o.created_by_id
          LEFT JOIN companies c ON c.id = o.company_id
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY o.request_date DESC, o.id DESC
        `;

        const [rows] = await db.query(sql, params);
        const orders = [];
        for (const row of rows) {
          const items = await loadItems(row.id);
          orders.push(mapOrder(row, items));
        }

        res.json({
          success: true,
          companyId: scope.companyId,
          canFullEdit: canFullEditPurchasing(req.user),
          orders,
          requests: orders,
        });
      } catch (error) {
        console.error("Error listing purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Get one PO
  app.get(
    "/api/purchasing/:id",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const order = await loadOrder(req.params.id);
        if (!order) {
          return res
            .status(404)
            .json({ success: false, error: "Purchase order not found" });
        }
        if (
          !isSuperadmin(req.user) &&
          order.company_id !== req.user.company_id
        ) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }
        res.json({ success: true, order });
      } catch (error) {
        console.error("Error loading purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Create PO
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

        const normalized = normalizeItems(req.body.items, { forCreate: true });
        if (normalized.error) {
          return res
            .status(400)
            .json({ success: false, error: normalized.error });
        }

        const urgency = URGENCIES.includes(req.body.urgency)
          ? req.body.urgency
          : "medium";
        const note = String(req.body.note || "").trim();

        const requestorResolved = await resolveRequestorId(
          req,
          scope.companyId,
          req.body.requestor_id,
        );
        if (requestorResolved?.error) {
          return res
            .status(400)
            .json({ success: false, error: requestorResolved.error });
        }
        const requestorId = requestorResolved;

        const poCode = await generatePoCode(scope.companyId);

        const [result] = await db.query(
          `INSERT INTO purchasing_orders
            (company_id, requestor_id, created_by_id, po_code, urgency, status,
             note, request_date, status_updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
          [
            scope.companyId,
            requestorId,
            req.user.id,
            poCode,
            urgency,
            note || null,
          ],
        );

        await upsertOrderItems(result.insertId, normalized.items);

        const order = await loadOrder(result.insertId);
        res.json({ success: true, order, request: order });
      } catch (error) {
        console.error("Error creating purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Update PO (content and/or status)
  app.put(
    "/api/purchasing/:id",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const existing = await loadOrder(req.params.id);
        if (!existing) {
          return res
            .status(404)
            .json({ success: false, error: "Purchase order not found" });
        }

        if (
          !isSuperadmin(req.user) &&
          existing.company_id !== req.user.company_id
        ) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        const gate = await assertCompanyPurchasingEnabled(existing.company_id);
        if (!gate.ok && !isSuperadmin(req.user)) {
          return res
            .status(gate.status)
            .json({ success: false, error: gate.error });
        }

        const fullEdit = canFullEditPurchasing(req.user);
        const isOwnerPending =
          (existing.requestor_id === req.user.id ||
            existing.created_by_id === req.user.id) &&
          existing.status === "pending";

        if (!fullEdit && !isOwnerPending) {
          return res.status(403).json({
            success: false,
            error: "Not allowed to edit this purchase order",
          });
        }

        let requestorId = existing.requestor_id;
        if (req.body.requestor_id !== undefined) {
          const resolved = await resolveRequestorId(
            req,
            existing.company_id,
            req.body.requestor_id,
          );
          if (resolved?.error) {
            return res
              .status(400)
              .json({ success: false, error: resolved.error });
          }
          requestorId = resolved;
        }

        const urgency = URGENCIES.includes(req.body.urgency)
          ? req.body.urgency
          : existing.urgency;
        const note =
          req.body.note != null
            ? String(req.body.note).trim()
            : existing.note || "";

        let received_proof_image = existing.received_proof_image;
        let received_note = existing.received_note || "";
        let received_at = existing.received_at;

        // Content items (owner or full edit) — skip during status-only updates
        if (
          Array.isArray(req.body.items) &&
          existing.status !== "received" &&
          req.body.statusScope !== "order" &&
          req.body.statusScope !== "items"
        ) {
          const incoming = req.body.items.map((item) => {
            const prev = existing.items.find((i) => i.id === Number(item.id));
            return {
              ...item,
              status: prev?.status || item.status || "pending",
              received_proof_image:
                prev?.received_proof_image || item.received_proof_image || null,
              received_note: prev?.received_note || item.received_note || "",
              received_at: prev?.received_at || item.received_at || null,
              supplier:
                item.supplier != null && item.supplier !== ""
                  ? item.supplier
                  : prev?.supplier || "",
            };
          });
          const normalized = normalizeItems(incoming);
          if (normalized.error) {
            return res
              .status(400)
              .json({ success: false, error: normalized.error });
          }
          await upsertOrderItems(existing.id, normalized.items);
        }

        // Status updates (full edit only)
        if (fullEdit) {
          const scopeMode =
            req.body.statusScope === "items" ? "items" : "order";

          if (scopeMode === "order" && req.body.status != null) {
            if (!ITEM_STATUSES.includes(req.body.status)) {
              return res
                .status(400)
                .json({ success: false, error: "Invalid status" });
            }

            if (req.body.received_proof_image !== undefined) {
              received_proof_image = req.body.received_proof_image
                ? String(req.body.received_proof_image)
                : null;
            }
            if (req.body.received_note !== undefined) {
              received_note = String(req.body.received_note || "").trim();
            }

            const recvErr = validateReceivedFields(
              req.body.status,
              received_proof_image,
              received_note,
              "PO",
            );
            if (recvErr) {
              return res.status(400).json({ success: false, error: recvErr });
            }

            if (req.body.status === "received") {
              received_at = existing.received_at || new Date();
            }

            // Apply same status to all items (single-supplier / whole PO)
            await db.query(
              `UPDATE purchasing_order_items SET
                status = ?,
                received_proof_image = CASE WHEN ? = 'received' THEN ? ELSE received_proof_image END,
                received_note = CASE WHEN ? = 'received' THEN ? ELSE received_note END,
                received_at = CASE WHEN ? = 'received' THEN ? ELSE received_at END
               WHERE order_id = ?`,
              [
                req.body.status,
                req.body.status,
                received_proof_image,
                req.body.status,
                received_note || null,
                req.body.status,
                received_at,
                existing.id,
              ],
            );
          }

          if (scopeMode === "items" && Array.isArray(req.body.itemStatuses)) {
            for (const row of req.body.itemStatuses) {
              const itemId = Number(row.id);
              if (!Number.isFinite(itemId)) continue;
              if (!ITEM_STATUSES.includes(row.status)) {
                return res.status(400).json({
                  success: false,
                  error: `Invalid status for item ${itemId}`,
                });
              }
              const proof = row.received_proof_image
                ? String(row.received_proof_image)
                : null;
              const rnote = String(row.received_note || "").trim();
              const recvErr = validateReceivedFields(
                row.status,
                proof,
                rnote,
                `Item ${itemId}`,
              );
              if (recvErr) {
                return res.status(400).json({ success: false, error: recvErr });
              }
              const supplier =
                row.supplier != null
                  ? String(row.supplier).trim() || null
                  : undefined;

              await db.query(
                `UPDATE purchasing_order_items SET
                  status = ?,
                  ${supplier !== undefined ? "supplier = ?," : ""}
                  received_proof_image = ?,
                  received_note = ?,
                  received_at = ?
                 WHERE id = ? AND order_id = ?`,
                supplier !== undefined
                  ? [
                      row.status,
                      supplier,
                      proof,
                      rnote || null,
                      row.status === "received" ? new Date() : null,
                      itemId,
                      existing.id,
                    ]
                  : [
                      row.status,
                      proof,
                      rnote || null,
                      row.status === "received" ? new Date() : null,
                      itemId,
                      existing.id,
                    ],
              );
            }
          }
        }

        const derivedStatus = await syncOrderStatus(existing.id);

        await db.query(
          `UPDATE purchasing_orders SET
            requestor_id = ?, urgency = ?, note = ?,
            received_proof_image = ?, received_note = ?, received_at = ?
           WHERE id = ?`,
          [
            requestorId,
            urgency,
            note || null,
            received_proof_image,
            received_note || null,
            derivedStatus === "received"
              ? received_at || new Date()
              : received_at,
            existing.id,
          ],
        );

        const order = await loadOrder(existing.id);
        res.json({ success: true, order, request: order });
      } catch (error) {
        console.error("Error updating purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );

  // Delete PO
  app.delete(
    "/api/purchasing/:id",
    authenticateToken,
    requireCompanyUser,
    async (req, res) => {
      try {
        const existing = await loadOrder(req.params.id);
        if (!existing) {
          return res
            .status(404)
            .json({ success: false, error: "Purchase order not found" });
        }

        if (
          !isSuperadmin(req.user) &&
          existing.company_id !== req.user.company_id
        ) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        const fullEdit = canFullEditPurchasing(req.user);
        const isOwnerPending =
          (existing.requestor_id === req.user.id ||
            existing.created_by_id === req.user.id) &&
          existing.status === "pending";

        if (!fullEdit && !isOwnerPending) {
          return res.status(403).json({
            success: false,
            error: "Not allowed to delete this purchase order",
          });
        }

        await db.query("DELETE FROM purchasing_orders WHERE id = ?", [
          existing.id,
        ]);
        res.json({ success: true, message: "Deleted" });
      } catch (error) {
        console.error("Error deleting purchasing:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    },
  );
};
