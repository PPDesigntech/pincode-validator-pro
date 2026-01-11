import type { LoaderFunctionArgs } from "react-router";

// eslint-disable-next-line no-empty-pattern
export const loader = async ({ }: LoaderFunctionArgs) => {
  return new Response("Pincode Validator Proxy OK", { status: 200 });
};