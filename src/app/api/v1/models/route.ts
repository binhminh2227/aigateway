import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, getAvailableModels } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const userKey = authHeader.replace("Bearer ", "").trim();

  if (userKey) {
    const { valid } = await validateApiKey(userKey);
    if (!valid) {
      return NextResponse.json(
        { error: { message: "Invalid API key", type: "authentication_error" } },
        { status: 401 }
      );
    }
  }

  const models = await getAvailableModels();
  return NextResponse.json({ object: "list", data: models });
}
