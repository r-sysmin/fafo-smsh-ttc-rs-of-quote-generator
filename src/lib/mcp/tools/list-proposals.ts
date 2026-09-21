import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_proposals",
  title: "List proposals",
  description: "List proposals (quotes) visible to the signed-in user, newest first, optionally filtered by status.",
  inputSchema: {
    status: z
      .enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"])
      .nullable()
      .describe("Optional status filter."),
    limit: z.number().int().min(1).max(100).nullable().describe("Maximum number of proposals to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("proposals")
      .select("id, title, status, subtotal, total, tax_rate, discount_total, valid_until, created_at, updated_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const proposals = (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status as string,
      client_name: (() => {
        const c = p.clients as unknown as { name: string } | { name: string }[] | null;
        const one = Array.isArray(c) ? c[0] : c;
        return one?.name ?? null;
      })(),
      subtotal: p.subtotal ?? null,
      total: p.total ?? null,
      tax_rate: p.tax_rate ?? null,
      discount_total: p.discount_total ?? null,
      valid_until: p.valid_until ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(proposals, null, 2) }],
      structuredContent: { proposals },
    };
  },
});
