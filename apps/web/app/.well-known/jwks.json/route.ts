import { getPublicJwks } from "@/core/auth/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getPublicJwks(), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}
