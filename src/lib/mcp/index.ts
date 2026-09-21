import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import createClientTool from "./tools/create-client";
import listProposalsTool from "./tools/list-proposals";
import getProposalTool from "./tools/get-proposal";
import listTemplatesTool from "./tools/list-templates";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fafo-smsh-ttc-rs-of-quote-generator",
  title: "FAFO-SMSH/TTC/RS of Quote Generator",
  version: "0.1.0",
  instructions:
    "Tools for the quote generator app. Use `list_proposals` and `get_proposal` to read quotes and their line items, `list_clients` and `create_client` for clients, and `list_templates` for proposal templates. All tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProposalsTool, getProposalTool, listClientsTool, createClientTool, listTemplatesTool],
});
