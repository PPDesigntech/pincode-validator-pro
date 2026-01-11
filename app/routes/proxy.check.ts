import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

function corsHeaders(origin: string | null) {
  // Allow your shop domain(s) + theme editor previews
  const allowed = [
    "https://ppdt-store.myshopify.com",
  ];

  // If you want to allow any *.myshopify.com (dev only), use this:
  const isMyShopify =
    origin && /^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(origin);

  const allowOrigin =
    (origin && allowed.includes(origin)) || isMyShopify ? origin! : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const pincode = (url.searchParams.get("pincode") || "").trim();

  if (!shop) {
    return new Response(JSON.stringify({ ok: false, error: "Missing shop" }), {
      status: 400,
      headers,
    });
  }

  if (!/^\d{6}$/.test(pincode)) {
    return new Response(
      JSON.stringify({ ok: true, deliverable: false, message: "Enter 6-digit pincode." }),
      { status: 200, headers }
    );
  }

  const rule = await db.pincodeRule.findUnique({
    where: { shop_pincode: { shop, pincode } },
    select: { deliverable: true, etaMinDays: true, etaMaxDays: true, codAvailable: true, shippingFee: true },
  });

  if (!rule || !rule.deliverable) {
    return new Response(
      JSON.stringify({ ok: true, deliverable: false, message: "Not deliverable for this pincode." }),
      { status: 200, headers }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      deliverable: true,
      etaMinDays: rule.etaMinDays,
      etaMaxDays: rule.etaMaxDays,
      codAvailable: rule.codAvailable,
      shippingFee: rule.shippingFee,
      message: "Delivery available.",
    }),
    { status: 200, headers }
  );
};
