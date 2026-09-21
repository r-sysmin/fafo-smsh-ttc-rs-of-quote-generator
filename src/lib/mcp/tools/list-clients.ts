import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List clients in the signed-in user's organization, newest first.",
  inputSchema: {
    search: z.string().trim().min(1).nullable().describe("Optional name or company text to filter by."),
    limit: z.number().int().min(1).max(100).nullable().describe("Maximum number of clients to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, name, company, email, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (search) query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    const clients = (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      created_at: c.created_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(clients, null, 2) }],
      structuredContent: { clients },
    };
  },
});
