import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_client",
  title: "Create client",
  description: "Create a new client record in the signed-in user's organization.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Client contact name."),
    company: z.string().trim().min(1).nullable().describe("Company name, if any."),
    email: z.string().trim().email().nullable().describe("Contact email, if any."),
    phone: z.string().trim().min(1).nullable().describe("Contact phone, if any."),
    notes: z.string().trim().min(1).nullable().describe("Internal notes, if any."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, company, email, phone, notes }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId!)
      .single();
    if (profileError) throw new ToolError(profileError.message);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name,
        company,
        email,
        phone,
        notes,
        created_by: userId,
        org_id: profile?.org_id ?? null,
      })
      .select("id, name, company, email, phone, created_at")
      .single();
    if (error) throw new ToolError(error.message);

    const client = {
      id: data.id,
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      created_at: data.created_at,
    };
    return {
      content: [{ type: "text", text: `Created client "${client.name}" (${client.id}).` }],
      structuredContent: { client },
    };
  },
});
