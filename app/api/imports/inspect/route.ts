import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { loadWorkbook, rowsForSheet } from "@/lib/imports/workbook";

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
  if (file.size > 1000 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 1000MB limit" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Shared loader — formulas are evaluated (cached values only used when
    // a formula can't resolve), and CSV files parse via papaparse.
    const parsed = await loadWorkbook(buffer, file.name);

    const worksheets = parsed.sheetNames.map((name) => {
      const rows = rowsForSheet(parsed, name);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const warnings: string[] = [];

      const formulas = parsed.formulaCells[name] ?? 0;
      const unevaluated = parsed.unevaluatedCells[name] ?? 0;
      const recovered = parsed.recoveredCells[name] ?? 0;
      if (formulas > 0) {
        warnings.push(
          unevaluated > 0
            ? `${formulas} formula cells — ${formulas - unevaluated} evaluated, ${unevaluated} used cached values`
            : recovered > 0
              ? `${formulas} formula cells — all evaluated (${recovered} had no cached value)`
              : `${formulas} formula cells — all evaluated`
        );
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
