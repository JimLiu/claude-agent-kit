import { ensureSessionWorkspace } from "../../ccsdk/utils/session-workspace";
import { readWorkspaceFiles } from "../../ccsdk/utils/workspace-files";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleWorkspaceSyncEndpoint(
  req: Request,
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId query parameter is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const workspaceDir = await ensureSessionWorkspace(sessionId);
    const files = await readWorkspaceFiles(workspaceDir);
    console.log(
      `[Workspace Sync] Session ${sessionId} returning ${Object.keys(files).length} files`,
    );

    return new Response(JSON.stringify(files), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Workspace sync error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to read session workspace",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
}
