import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";

/**
 * POST /api/imports/inspect
 * Accepts a workbook upload, parses worksheets into metadata + first-row
 * samples. Nothing is persisted — that only happens on /process, after the
 * operator confirms configuration. Requires imports.preview permission.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("imports.preview")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 100MB limit" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellDates: true });

    const worksheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: true,
      });
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const warnings: string[] = [];

      // Formula-containing cells warn — formulas are NOT executed as business logic.
      let formulaCells = 0;
      for (const addr of Object.keys(sheet)) {
        if (addr.startsWith("!")) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((sheet as any)[addr]?.f) formulaCells++;
      }
      if (formulaCells > 0) {
        warnings.push(`${formulaCells} formula cells — formulas are read as values only`);
      }
      if (headers.length === 0) warnings.push("No header row detected");

      return {
        name,
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
        preview: rows.slice(0, 8),
        warnings,
      };
    });

    return NextResponse.json({
      fileName: file.name,
      fileSizeBytes: file.size,
      checksum: `sha256:${checksum.slice(0, 12)}`,
      worksheets,
      totalRows: worksheets.reduce((n, w) => n + w.rowCount, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse workbook";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
