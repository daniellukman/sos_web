import "server-only";
import ExcelJS from "exceljs";

export type ExcelColumn<T> = {
  header: string;
  width: number;
  value: (row: T) => string | number | Date | null;
  format?: "tanggal" | "rupiah" | "angka";
  /** Tambahkan SUM di baris total */
  total?: boolean;
};

const FORMAT = { tanggal: "dd/mm/yyyy", rupiah: "#,##0;[Red]-#,##0", angka: "0" } as const;
const HEADER_ROW = 4;

/** "2026-09-17" -> Date (UTC) agar tersimpan sebagai tanggal asli Excel. */
export const tanggalExcel = (d: string | Date | null | undefined) =>
  !d ? null : d instanceof Date ? d : new Date(`${d.slice(0, 10)}T00:00:00Z`);

/**
 * Buat file .xlsx satu sheet: judul, keterangan filter, header berwarna, baris data,
 * baris total (SUM), autofilter dan header yang tetap terlihat saat di-scroll.
 */
export async function buatExcel<T>(opts: {
  sheet: string;
  judul: string;
  keterangan: string[];
  columns: ExcelColumn<T>[];
  rows: T[];
  labelTotal: string;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheet, { views: [{ state: "frozen", ySplit: HEADER_ROW }] });
  ws.columns = opts.columns.map((c) => ({ width: c.width }));

  ws.getCell("A1").value = opts.judul;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = opts.keterangan.join(" · ");
  ws.getCell("A2").font = { color: { argb: "FF52514E" } };

  const header = ws.getRow(HEADER_ROW);
  header.values = opts.columns.map((c) => c.header);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2A78D6" } };
  });

  for (const row of opts.rows) ws.addRow(opts.columns.map((c) => c.value(row)));

  opts.columns.forEach((c, i) => {
    if (c.format) ws.getColumn(i + 1).numFmt = FORMAT[c.format];
  });

  const first = HEADER_ROW + 1;
  const last = HEADER_ROW + opts.rows.length;
  if (opts.rows.length) {
    const total = ws.addRow([opts.labelTotal]);
    opts.columns.forEach((c, i) => {
      if (!c.total) return;
      const col = ws.getColumn(i + 1).letter;
      total.getCell(i + 1).value = { formula: `SUM(${col}${first}:${col}${last})` };
    });
    total.font = { bold: true };
    total.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: "thin" } };
    });
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: last, column: opts.columns.length } };
  }

  return wb.xlsx.writeBuffer();
}

export function waktuExport(userid: string) {
  const waktu = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date());
  return `Diekspor ${waktu} oleh ${userid}`;
}

export function responseExcel(buffer: ArrayBuffer, namaFile: string) {
  const tanggal = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaFile}-${tanggal}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
