import type { Prisma } from "@prisma/client";
import { useEffect, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import db from "../db.server";

/* ======================
   Types
====================== */
type RuleRow = {
  id: string;
  shop: string;
  pincode: string;
  deliverable: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  codAvailable: boolean;
  shippingFee: number | null;
};

type LoaderData = {
  rules: RuleRow[];
};

type BulkResponse =
  | { ok: true; inserted: number; updated: number; invalidCount: number; invalid: Array<{ row: number; reason: string; pincode?: string }> }
  | { ok: false; error: string };

type ActionResponse =
  | { ok: true }
  | { ok: false; error: string }
  | BulkResponse;

/* ======================
   Helpers
====================== */
function toBool(val: string | null, fallback = false) {
  if (!val) return fallback;
  const v = val.toString().trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function toIntOrNull(val: string | null) {
  if (!val) return null;
  const s = val.toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function parseCsv(text: string) {
  // Simple CSV parser: commas + newlines, no quoted commas
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { headers: [], rows: [] as Array<Record<string, string>> };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });

  return { headers, rows };
}

/* ======================
   Loader
====================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rules = await db.pincodeRule.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shop: true,
      pincode: true,
      deliverable: true,
      etaMinDays: true,
      etaMaxDays: true,
      codAvailable: true,
      shippingFee: true,
    },
  });

  return json<LoaderData>({ rules });
};

/* ======================
   Action
====================== */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  const bad = (error: string, status = 400) =>
    json<ActionResponse>({ ok: false, error }, { status });

  if (intent === "create") {
    const pincode = String(form.get("pincode") || "").trim();
    if (!/^\d{6}$/.test(pincode)) return bad("Pincode must be exactly 6 digits.");

    const deliverable = toBool(form.get("deliverable") as string, true);
    const codAvailable = toBool(form.get("codAvailable") as string, false);

    const etaMinDays = toIntOrNull(form.get("etaMinDays") as string);
    const etaMaxDays = toIntOrNull(form.get("etaMaxDays") as string);
    const shippingFee = toIntOrNull(form.get("shippingFee") as string);

    // validation if provided but invalid
    const etaMinRaw = String(form.get("etaMinDays") || "").trim();
    const etaMaxRaw = String(form.get("etaMaxDays") || "").trim();
    const shipRaw = String(form.get("shippingFee") || "").trim();

    if (etaMinRaw && etaMinDays === null) return bad("ETA Min must be a non-negative integer.");
    if (etaMaxRaw && etaMaxDays === null) return bad("ETA Max must be a non-negative integer.");
    if (shipRaw && shippingFee === null) return bad("Shipping fee must be a non-negative integer.");

    await db.pincodeRule.upsert({
      where: { shop_pincode: { shop: session.shop, pincode } },
      update: { deliverable, etaMinDays, etaMaxDays, codAvailable, shippingFee },
      create: { shop: session.shop, pincode, deliverable, etaMinDays, etaMaxDays, codAvailable, shippingFee },
    });

    return json<ActionResponse>({ ok: true });
  }

  if (intent === "bulk_upload") {
    const file = form.get("file");
    if (!(file instanceof File)) return bad("Please upload a CSV file.");

    const csvText = await file.text();
    const { headers, rows } = parseCsv(csvText);

    if (!headers.map((h) => h.toLowerCase()).includes("pincode")) {
      return bad('CSV must include a "pincode" column.');
    }

    // normalize keys to be tolerant with header cases
    const headerMap = new Map(headers.map((h) => [h.toLowerCase(), h]));

    const invalid: Array<{ row: number; reason: string; pincode?: string }> = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // collect pincodes for existing check
    const parsedPincodes = rows
      .map((r) => String(r[headerMap.get("pincode")!] || "").trim())
      .filter((p) => /^\d{6}$/.test(p));

    const existing = await db.pincodeRule.findMany({
      where: { shop: session.shop, pincode: { in: parsedPincodes } },
      select: { pincode: true },
    });
    const existingSet = new Set(existing.map((e) => e.pincode));

    rows.forEach((r, idx) => {
      const rowNo = idx + 2;

      const pincode = String(r[headerMap.get("pincode")!] || "").trim();
      if (!/^\d{6}$/.test(pincode)) {
        invalid.push({ row: rowNo, reason: "Invalid pincode (must be 6 digits).", pincode });
        return;
      }

      const deliverable = toBool(r[headerMap.get("deliverable") ?? ""] ?? null, true);
      const codAvailable = toBool(r[headerMap.get("codavailable") ?? ""] ?? r[headerMap.get("codAvailable") ?? ""] ?? null, false);

      const etaMinStr = r[headerMap.get("etamindays") ?? r["etaMinDays"] ?? ""] ?? r[headerMap.get("etaMinDays") ?? ""] ?? "";
      const etaMaxStr = r[headerMap.get("etamaxdays") ?? r["etaMaxDays"] ?? ""] ?? r[headerMap.get("etaMaxDays") ?? ""] ?? "";
      const shipStr = r[headerMap.get("shippingfee") ?? r["shippingFee"] ?? ""] ?? r[headerMap.get("shippingFee") ?? ""] ?? "";

      const etaMinDays = toIntOrNull(String(etaMinStr || "").trim() || null);
      const etaMaxDays = toIntOrNull(String(etaMaxStr || "").trim() || null);
      const shippingFee = toIntOrNull(String(shipStr || "").trim() || null);

      if (String(etaMinStr || "").trim() && etaMinDays === null) {
        invalid.push({ row: rowNo, reason: "etaMinDays must be a non-negative integer.", pincode });
        return;
      }
      if (String(etaMaxStr || "").trim() && etaMaxDays === null) {
        invalid.push({ row: rowNo, reason: "etaMaxDays must be a non-negative integer.", pincode });
        return;
      }
      if (String(shipStr || "").trim() && shippingFee === null) {
        invalid.push({ row: rowNo, reason: "shippingFee must be a non-negative integer.", pincode });
        return;
      }

      ops.push(
        db.pincodeRule.upsert({
          where: { shop_pincode: { shop: session.shop, pincode } },
          update: { deliverable, etaMinDays, etaMaxDays, codAvailable, shippingFee },
          create: { shop: session.shop, pincode, deliverable, etaMinDays, etaMaxDays, codAvailable, shippingFee },
        })
      );
    });

    // execute writes
    if (ops.length) await db.$transaction(ops);

    // compute counts
    let inserted = 0;
    let updated = 0;
    parsedPincodes.forEach((p) => (existingSet.has(p) ? updated++ : inserted++));

    return json<ActionResponse>({
      ok: true,
      inserted,
      updated,
      invalidCount: invalid.length,
      invalid: invalid.slice(0, 50),
    });
  }

  if (intent === "delete") {
    const id = String(form.get("id") || "").trim();
    if (!id) return bad("Missing id");
    await db.pincodeRule.delete({ where: { id } });
    return json<ActionResponse>({ ok: true });
  }

  return bad("Unknown intent");
};

/* ======================
   Component
====================== */
export default function PincodesPage() {
  const { rules } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<ActionResponse>();

  const error = fetcher.data && "ok" in fetcher.data && fetcher.data.ok === false ? (fetcher.data as any).error : null;

  useEffect(() => {
    // after successful bulk upload or single create/delete, reload to see fresh rules
    if (fetcher.data && (fetcher.data as any).ok === true) {
      // small delay to avoid flicker in embedded iframe
      setTimeout(() => window.location.reload(), 200);
    }
  }, [fetcher.data]);

  const rows = useMemo(() => {
    return rules.map((r) => ({
      ...r,
      eta: r.etaMinDays || r.etaMaxDays ? `${r.etaMinDays ?? "-"} - ${r.etaMaxDays ?? "-"}` : "-",
      codText: r.codAvailable ? "Yes" : "No",
      deliverText: r.deliverable ? "Yes" : "No",
      shipText: r.shippingFee ?? "-",
    }));
  }, [rules]);

  return (
    <s-page heading="Pincode Rules">
      {error ? (
        <s-banner tone="critical">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      ) : null}

      <s-section heading="Bulk Upload (CSV)">
        <div style={{ padding: 16, border: "1px solid rgba(0,0,0,.12)", borderRadius: 12 }}>
          <fetcher.Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="bulk_upload" />
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" name="file" accept=".csv,text/csv" required />
              <button type="submit" style={btnStyle}>
                {fetcher.state !== "idle" ? "Uploading..." : "Upload CSV"}
              </button>

              <a
                href="data:text/csv;charset=utf-8,pincode,deliverable,etaMinDays,etaMaxDays,codAvailable,shippingFee%0A110001,true,2,4,true,49%0A110005,true,5,7,false,50%0A"
                download="pincode-sample.csv"
                style={{ textDecoration: "underline" }}
              >
                Download sample CSV
              </a>
            </div>
          </fetcher.Form>

          {fetcher.data && (fetcher.data as any).ok === true && (fetcher.data as any).inserted !== undefined ? (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0 }}>
                ✅ Imported. Inserted: <b>{(fetcher.data as any).inserted}</b>, Updated:{" "}
                <b>{(fetcher.data as any).updated}</b>, Invalid: <b>{(fetcher.data as any).invalidCount}</b>
              </p>

              {(fetcher.data as any).invalid?.length ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>First invalid rows:</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(fetcher.data as any).invalid.map((x: any, i: number) => (
                      <li key={i}>
                        Row {x.row}: {x.reason} {x.pincode ? `(pincode: ${x.pincode})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Add / Update Single Rule">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="create" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 140px 140px 160px 160px 160px",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <label htmlFor="pv_pincode" style={labelStyle}>Pincode</label>
              <input id="pv_pincode" name="pincode" placeholder="110001" maxLength={6} inputMode="numeric" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Deliverable</label>
              <select name="deliverable" style={inputStyle}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>COD Available</label>
              <select name="codAvailable" style={inputStyle}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>ETA Min (days)</label>
              <input name="etaMinDays" placeholder="2" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>ETA Max (days)</label>
              <input name="etaMaxDays" placeholder="4" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Shipping Fee (₹)</label>
              <input name="shippingFee" placeholder="49" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" style={btnStyle}>
              {fetcher.state !== "idle" ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </fetcher.Form>
      </s-section>

      <s-section heading="Existing Rules">
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Pincode</th>
                <th style={thStyle}>Deliverable</th>
                <th style={thStyle}>ETA (Min-Max)</th>
                <th style={thStyle}>COD</th>
                <th style={thStyle}>Shipping (₹)</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.pincode}</td>
                  <td style={tdStyle}>{r.deliverText}</td>
                  <td style={tdStyle}>{r.eta}</td>
                  <td style={tdStyle}>{r.codText}</td>
                  <td style={tdStyle}>{r.shipText}</td>
                  <td style={tdStyle}>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" style={btnDangerStyle}>Delete</button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>No rules found yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </s-section>
    </s-page>
  );
}

/* ======================
   Styles
====================== */
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 6 };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(0,0,0,.15)",
  borderRadius: 10,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
  background: "#b42318",
  color: "white",
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  padding: "10px 8px",
  borderBottom: "1px solid rgba(0,0,0,.12)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(0,0,0,.08)",
  fontSize: 13,
};