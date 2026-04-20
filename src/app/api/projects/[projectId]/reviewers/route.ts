import { NextResponse } from "next/server";
import { getProjectReviewers } from "@/actions/project/get-project-reviewers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        if (!projectId) {
            return new NextResponse("Project ID is required", { status: 400 });
        }

        // We can reuse the existing logic but call it from here
        // Since we are inside an API route, this calling won't trigger the "Action Refresh" loop
        const reviewers = await getProjectReviewers(projectId);

        return NextResponse.json(reviewers);
    } catch (error) {
        console.error("[PROJECT_REVIEWERS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
