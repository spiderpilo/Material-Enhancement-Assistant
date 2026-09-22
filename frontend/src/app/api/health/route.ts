// Read APP_VERSION per request so the value comes from the running container.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", version: process.env.APP_VERSION || "dev" });
}
