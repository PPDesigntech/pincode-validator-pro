import { useMemo } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import db from "../db.server";

type LoaderData = {
  shop: string;
  totalRules: number;
  deliverableCount: number;
  blockedCount: number;
  lastUpdatedAt: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rules = await db.pincodeRule.findMany({
    where: { shop: session.shop },
    select: { deliverable: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const totalRules = rules.length;
  const deliverableCount = rules.filter((r) => r.deliverable).length;
  const blockedCount = totalRules - deliverableCount;
  const lastUpdatedAt = rules[0]?.createdAt ? new Date(rules[0].createdAt).toISOString() : null;

  return json<LoaderData>({
    shop: session.shop,
    totalRules,
    deliverableCount,
    blockedCount,
    lastUpdatedAt,
  });
};

export default function AppHome() {
  const data = useLoaderData<LoaderData>();

  const lastUpdatedText = useMemo(() => {
    if (!data.lastUpdatedAt) return "—";
    const d = new Date(data.lastUpdatedAt);
    return d.toLocaleString();
  }, [data.lastUpdatedAt]);

  return (
    <s-page heading="Pincode Validator Pro" subtitle={`Store: ${data.shop}`}>
      {/* Top cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16 }}>
        <s-card>
          <s-stack gap="400">
            <div>
              <s-heading>Quick setup</s-heading>
              <s-text tone="subdued">
                Add the widget to your theme, then create rules to control delivery availability.
              </s-text>
            </div>

            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                Theme editor → <b>App embeds</b> → Enable <b>Pincode Validator</b> → Save
              </li>
              <li>
                Add rules in <b>Pincodes</b> (global rules) or upload CSV
              </li>
              <li>
                Test on product page using a pincode
              </li>
            </ol>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/app/pincodes" style={btnPrimary}>
                Manage rules
              </Link>
              <Link to="/app/settings" style={btnSecondary}>
                Settings
              </Link>
              <a
                href="https://help.shopify.com/en/manual/online-store/themes/theme-structure/theme-editor/app-embeds"
                target="_blank"
                rel="noreferrer"
                style={btnSecondary}
              >
                How to enable app embed
              </a>
            </div>
          </s-stack>
        </s-card>

        <s-card>
          <s-stack gap="400">
            <s-heading>Rule snapshot</s-heading>

            <div style={statGrid}>
              <div style={statBox}>
                <div style={statLabel}>Total rules</div>
                <div style={statValue}>{data.totalRules}</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>Deliverable</div>
                <div style={statValue}>{data.deliverableCount}</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>Blocked</div>
                <div style={statValue}>{data.blockedCount}</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>Last updated</div>
                <div style={{ ...statValue, fontSize: 14 }}>{lastUpdatedText}</div>
              </div>
            </div>

            <s-banner tone={data.totalRules ? "success" : "warning"}>
              <s-paragraph>
                {data.totalRules
                  ? "✅ Rules are configured. Next: enable restriction features and product/collection rules."
                  : "⚠️ No rules found. Add at least 1 rule or upload a CSV to start validating pincodes."}
              </s-paragraph>
            </s-banner>
          </s-stack>
        </s-card>
      </div>

      {/* Bottom section */}
      <div style={{ marginTop: 16 }}>
        <s-section heading="What do you want to do next?">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <s-card>
              <s-stack gap="300">
                <s-heading>Bulk upload pincodes</s-heading>
                <s-text tone="subdued">Upload a CSV to add or update rules in seconds.</s-text>
                <Link to="/app/pincodes" style={btnPrimary}>
                  Upload CSV
                </Link>
              </s-stack>
            </s-card>

            <s-card>
              <s-stack gap="300">
                <s-heading>Restrict Add to Cart</s-heading>
                <s-text tone="subdued">
                  Disable Add to Cart / Checkout when the pincode is not deliverable.
                </s-text>
                <Link to="/app/settings" style={btnPrimary}>
                  Configure restriction
                </Link>
              </s-stack>
            </s-card>

            <s-card>
              <s-stack gap="300">
                <s-heading>Product/collection rules</s-heading>
                <s-text tone="subdued">
                  Apply different delivery rules for specific products or collections.
                </s-text>
                <Link to="/app/rules" style={btnPrimary}>
                  Create advanced rules
                </Link>
              </s-stack>
            </s-card>
          </div>
        </s-section>
      </div>
    </s-page>
  );
}

/* --- inline styles (match your current style approach) --- */
const btnPrimary: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
  background: "white",
  color: "black",
  textDecoration: "none",
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};

const statBox: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.12)",
  borderRadius: 12,
  padding: 12,
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
};

const statValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
};
