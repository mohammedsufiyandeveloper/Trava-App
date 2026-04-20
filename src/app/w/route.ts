import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "../../lib/auth/require-user";
import { AuthError } from "@/lib/errors/auth-errors";
import { getWorkspaces } from "@/data/workspace/get-workspaces";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  try {
    const session = await requireUser();

    if (!session?.id) {
      return NextResponse.redirect(`${origin}/sign-in`);
    }

    const { workspaces } = await getWorkspaces();

    if (!workspaces?.length) {
      return NextResponse.redirect(`${origin}/create-workspace?noWorkspace=1`);
    }

    const firstId = workspaces[0].id;
    return NextResponse.redirect(`${origin}/w/${firstId}`);
  } catch (err: any) {
    if (err instanceof AuthError || err?.message === "missing_user_id") {
      return NextResponse.redirect(`${origin}/sign-in`);
    }

    console.error("workspace route error:", err);

    return NextResponse.redirect(`${origin}/`);
  }
}
