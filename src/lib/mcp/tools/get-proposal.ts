import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_proposal",
  title: "Get proposal",
  description: "Get one proposal with its line items, by proposal id.",
  inputSchema: {
    proposal_id: z.string().uuid().describe("The proposal id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ proposal_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("proposals")
      .select("id, title, status, notes, subtotal, total, tax_rate, discount_total, valid_until, created_at, updated_at, clients(name, company, email)")
      .eq("id", proposal_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Proposal not found or not accessible");

    const { data: items, error: itemsError } = await supabase
      .from("line_items")
      .select("id, description, quantity, rate, discount, amount, sort_order")
      .eq("proposal_id", proposal_id)
      .order("sort_order", { ascending: true });
    if (itemsError) throw new ToolError(itemsError.message);

    type ClientRow = { name: string; company: string | null; email: string | null };
    const rawClient = data.clients as unknown as ClientRow | ClientRow[] | null;
    const client = Array.isArray(rawClient) ? rawClient[0] ?? null : rawClient;
    const proposal = {
      id: data.id,
      title: data.title,
      status: data.status as string,
      notes: data.notes ?? null,
      subtotal: data.subtotal ?? null,
      total: data.total ?? null,
      tax_rate: data.tax_rate ?? null,
      discount_total: data.discount_total ?? null,
      valid_until: data.valid_until ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      client: client ? { name: client.name, company: client.company ?? null, email: client.email ?? null } : null,
      line_items: (items ?? []).map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        rate: i.rate,
        discount: i.discount ?? null,
        amount: i.amount ?? null,
        sort_order: i.sort_order,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(proposal, null, 2) }],
      structuredContent: { proposal },
    };
  },
});
