import { deliverPdf, getPdfMake } from "./pdfExport";
import { splitBilingualSlash } from "./translator";
import { PURCHASING_UNITS } from "./units";

const NAVY = "#1B2A4A";
const TEXT = "#1a1a1a";
const MUTED = "#5A6578";
const HEADER = "#D6E0F0";
const LINE = "#C5CED9";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const STATUS = {
  pending: ["Menunggu", "待处理"],
  approved: ["Disetujui", "已批准"],
  ordered: ["Dipesan", "已下单"],
  received: ["Diterima", "已收货"],
  rejected: ["Ditolak", "已拒绝"],
  partial: ["Sebagian", "部分完成"],
};

const URGENCY = {
  low: ["Rendah", "低"],
  medium: ["Sedang", "中"],
  high: ["Tinggi", "高"],
};

const CATEGORY = {
  office: ["Kebutuhan office", "办公需求"],
  production: ["Kebutuhan produksi", "生产需求"],
};

function isMostlyChinese(line) {
  const chars = String(line || "").replace(/\s/g, "");
  if (!chars) return false;
  const chinese = (chars.match(/[\u4e00-\u9fa5]/g) || []).length;
  return chinese / chars.length >= 0.4;
}

function linesOf(text) {
  const raw = String(text || "").trim();
  if (!raw) return { id: "", zh: "" };
  const slash = splitBilingualSlash(raw);
  if (slash) return slash;
  const parts = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const zh = parts.find((line) => isMostlyChinese(line));
    const id = parts.find((line) => line !== zh && !isMostlyChinese(line));
    if (zh && id) return { id, zh };
  }
  if (isMostlyChinese(raw)) return { id: "", zh: raw };
  return { id: raw, zh: "" };
}

function stack(id, zh, { size = 10, bold = false, color = TEXT, margin = 0 } = {}) {
  const body = [];
  if (id) body.push({ text: String(id), fontSize: size, bold, color });
  if (zh) {
    body.push({
      text: String(zh),
      fontSize: Math.max(8, size - 2),
      color: MUTED,
      margin: id ? [0, 1, 0, 0] : 0,
    });
  }
  if (!body.length) body.push({ text: "—", fontSize: size, color: MUTED });
  return { stack: body, margin };
}

function knownPair(map, value) {
  const pair = map[value];
  if (!pair) return linesOf(value);
  return { id: pair[0], zh: pair[1] };
}

function formatWhen(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return linesOf(raw);
  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timeId = match[4] ? ` ${match[4]}.${match[5]}` : "";
  const timeZh = match[4] ? ` ${match[4]}:${match[5]}` : "";
  return {
    id: `${day} ${MONTHS_ID[month - 1] || ""} ${year}${timeId}`,
    zh: `${year}年${month}月${day}日${timeZh}`,
  };
}

function qtyPair(item) {
  const qty = item?.quantity ?? "";
  const unit = PURCHASING_UNITS.find((row) => row.value === item?.unit);
  if (!unit) {
    const suffix = item?.unit ? ` ${item.unit}` : "";
    return { id: `${qty}${suffix}`.trim(), zh: "" };
  }
  return { id: `${qty} ${unit.id}`, zh: `${qty} ${unit.zh}` };
}

function meta(labelId, labelZh, value) {
  return {
    stack: [
      stack(labelId, labelZh, { size: 8, color: MUTED }),
      stack(value.id, value.zh, { size: 11, bold: true, margin: [0, 3, 0, 0] }),
    ],
  };
}

function itemNameCell(item) {
  const name = linesOf(item.item_name);
  const note = linesOf(item.note);
  const body = stack(name.id, name.zh, { size: 10, bold: true }).stack;
  if (note.id || note.zh) {
    body.push({
      ...stack(note.id, note.zh, { size: 8, color: MUTED, margin: [0, 3, 0, 0] }),
    });
  }
  return { stack: body };
}

/** A4 purchase-order document. Labels are Bahasa Indonesia with Chinese underneath. */
export function purchaseOrderDocument(order) {
  const code = order?.po_code || "PO";
  const when = formatWhen(order?.request_date);
  const urgency = knownPair(URGENCY, order?.urgency);
  const status = knownPair(STATUS, order?.status);
  const note = linesOf(order?.note);
  const items = Array.isArray(order?.items) ? order.items : [];

  const headerCell = (id, zh) =>
    stack(id, zh, { size: 9, bold: true, color: NAVY });

  const itemRows = items.length
    ? items.map((item, index) => {
        const category = knownPair(CATEGORY, item.category);
        const itemStatus = knownPair(STATUS, item.status);
        const supplier = linesOf(item.supplier);
        const qty = qtyPair(item);
        return [
          { text: String(index + 1), fontSize: 10, color: MUTED, margin: [0, 2, 0, 0] },
          itemNameCell(item),
          stack(qty.id, qty.zh, { size: 10 }),
          stack(category.id, category.zh, { size: 9 }),
          stack(supplier.id || "—", supplier.zh, { size: 9 }),
          stack(itemStatus.id, itemStatus.zh, { size: 9 }),
        ];
      })
    : [
        [
          {
            colSpan: 6,
            ...stack("Belum ada barang", "暂无物品", { size: 10, color: MUTED }),
          },
          {},
          {},
          {},
          {},
          {},
        ],
      ];

  const receipts = items.filter(
    (item) => item.received_note || item.received_at,
  );

  const content = [];
  if (order?.company_name) {
    content.push({
      text: String(order.company_name),
      fontSize: 13,
      bold: true,
      color: NAVY,
    });
  }
  content.push(
    {
      text: "Pesanan pembelian",
      fontSize: 18,
      bold: true,
      color: NAVY,
      margin: [0, order?.company_name ? 10 : 0, 0, 0],
    },
    { text: "采购单", fontSize: 11, color: MUTED, margin: [0, 2, 0, 14] },
    { text: String(code), fontSize: 14, bold: true, color: TEXT, margin: [0, 0, 0, 12] },
    {
      columns: [
        meta("Tanggal permintaan", "申请日期", when),
        meta("Pemohon", "申请人", {
          id: order?.requestor_name || "—",
          zh: order?.requestor_email || "",
        }),
      ],
      columnGap: 16,
      margin: [0, 0, 0, 8],
    },
    {
      columns: [
        meta("Urgensi", "紧急程度", urgency),
        meta("Status", "状态", status),
      ],
      columnGap: 16,
      margin: [0, 0, 0, 8],
    },
  );

  if (
    order?.created_by_name &&
    order.created_by_id &&
    order.created_by_id !== order.requestor_id
  ) {
    content.push({
      ...meta("Diajukan oleh", "提交人", {
        id: order.created_by_name,
        zh: order.created_by_email || "",
      }),
      margin: [0, 0, 0, 8],
    });
  }

  if (note.id || note.zh) {
    content.push({
      ...meta("Catatan PO", "采购单备注", note),
      margin: [0, 0, 0, 14],
    });
  }

  content.push(
    stack("Barang", "物品", { size: 12, bold: true, color: NAVY, margin: [0, 4, 0, 8] }),
    {
      table: {
        headerRows: 1,
        widths: [22, "*", 72, 88, 78, 72],
        body: [
          [
            headerCell("No.", "序号"),
            headerCell("Nama barang", "物品名称"),
            headerCell("Jumlah", "数量"),
            headerCell("Kategori", "类别"),
            headerCell("Supplier", "供应商"),
            headerCell("Status", "状态"),
          ],
          ...itemRows,
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        hLineColor: () => LINE,
        fillColor: (rowIndex) => (rowIndex === 0 ? HEADER : null),
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
    },
  );

  if (receipts.length) {
    content.push(
      stack("Penerimaan", "收货记录", {
        size: 12,
        bold: true,
        color: NAVY,
        margin: [0, 18, 0, 8],
      }),
    );
    for (const item of receipts) {
      const name = linesOf(item.item_name);
      const received = linesOf(item.received_note);
      const at = formatWhen(item.received_at);
      content.push({
        stack: [
          stack(name.id, name.zh, { size: 10, bold: true }),
          stack(received.id, received.zh, { size: 10, margin: [0, 2, 0, 0] }),
          item.received_at
            ? stack(`Diterima pada ${at.id}`, `收货时间 ${at.zh}`, {
                size: 8,
                color: MUTED,
                margin: [0, 2, 0, 0],
              })
            : { text: "" },
        ],
        margin: [0, 0, 0, 8],
      });
    }
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const printed = formatWhen(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  );
  content.push(
    stack(`Dicetak ${printed.id}`, `打印时间 ${printed.zh}`, {
      size: 8,
      color: MUTED,
      margin: [0, 18, 0, 0],
    }),
  );

  return {
    fileName: code,
    definition: {
      pageSize: "A4",
      pageMargins: [48, 48, 48, 48],
      defaultStyle: { font: "NotoSansSC", fontSize: 10 },
      content,
    },
  };
}

/** Download one purchase order as an A4 PDF. */
export async function exportPurchaseOrderPdf(order) {
  const pdfMake = getPdfMake();
  const { fileName, definition } = purchaseOrderDocument(order);
  await deliverPdf(pdfMake, definition, fileName);
}
