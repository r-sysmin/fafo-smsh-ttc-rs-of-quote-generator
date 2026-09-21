import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_templates",
  title: "List templates",
  description: "List proposal templates available to the signed-in user.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).nullable().describe("Maximum number of templates to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("templates")
      .select("id, name, description, category, is_default, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) throw new ToolError(error.message);

    const templates = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      category: t.category as string,
      is_default: t.is_default,
      created_at: t.created_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(templates, null, 2) }],
      structuredContent: { templates },
    };
  },
});
