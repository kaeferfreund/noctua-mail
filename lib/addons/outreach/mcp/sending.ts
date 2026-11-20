import { z } from "zod";
import { getOutreachDb } from "../db";
import { cancelCampaign, editSequence, scheduleCampaign, setSequenceStatus } from "../sending/actions";
import { campaignInput, itemId, scheduleInput, sequenceInput, statusInput, templateInput } from "../sending/input";
import {
  campaignReport, getCampaign, getSequence, getTemplate, listCampaigns, listSequences, listTemplates, saveCampaign,
  saveSequence, saveTemplate
} from "../sending/store";
import { outreachViaMcp } from "../via";
import type { OutreachMcpAccount, OutreachMcpHost } from "./index";

const mailbox = z.object({ accountId: itemId.optional() });
const campaignId = { campaignId: itemId };
const sequenceId = { sequenceId: itemId };
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const edit = { readOnlyHint: false, openWorldHint: false };
const send = { readOnlyHint: false, openWorldHint: true };
const actor = (account: OutreachMcpAccount) => ({ accountId: account.accountId, authorization: { tokenId: account.tokenId },
  via: outreachViaMcp(account.tokenLabel, account.tokenSuffix) });

export function registerOutreachSendingTools(host: OutreachMcpHost) {
  const { server, outreachAccount, result } = host;
  server.registerTool("list_email_templates", { description: "List email template summaries.", inputSchema: mailbox, annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Email templates", { ok: true, templates: listTemplates(await getOutreachDb(), accountId) });
  });
  server.registerTool("get_email_template", { description: "Read an email template with its HTML and text.", inputSchema: mailbox.extend({ templateId: itemId }), annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Email template", { ok: true, template: getTemplate(await getOutreachDb(), accountId, args.templateId) });
  });
  server.registerTool("save_email_template", {
    description: "Create or edit an email template. Supply a name when creating a template.",
    inputSchema: templateInput.partial().extend({ ...mailbox.shape, templateId: itemId.optional() }), annotations: edit
  }, async ({ accountId: requested, templateId, ...input }) => {
    const { accountId, userId } = await outreachAccount(requested, "editor");
    return result("Email template saved", { ok: true, template: saveTemplate(await getOutreachDb(), accountId, input, { id: templateId, userId }) });
  });

  server.registerTool("list_campaigns", { description: "List newsletter campaigns with their status and statistics.", inputSchema: mailbox, annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Campaigns", { ok: true, campaigns: await listCampaigns(await getOutreachDb(), accountId) });
  });
  server.registerTool("get_campaign", { description: "Read campaign content and audience.", inputSchema: mailbox.extend(campaignId), annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Campaign", { ok: true, campaign: getCampaign(await getOutreachDb(), accountId, args.campaignId) });
  });
  server.registerTool("get_campaign_report", {
    description: "Read campaign statistics, link clicks and paginated sends.",
    inputSchema: mailbox.extend({ ...campaignId, cursor: z.string().max(512).optional() }), annotations: readOnly
  }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Campaign report", await campaignReport(await getOutreachDb(), accountId, args.campaignId, args.cursor));
  });
  server.registerTool("save_campaign", {
    description: "Create or edit a draft newsletter campaign.",
    inputSchema: campaignInput.extend({ ...mailbox.shape, campaignId: itemId.optional() }), annotations: edit
  }, async ({ accountId: requested, campaignId, ...input }) => {
    const { accountId, userId } = await outreachAccount(requested, "editor");
    return result("Campaign draft saved", { ok: true, campaign: saveCampaign(await getOutreachDb(), accountId, userId, input, campaignId) });
  });
  server.registerTool("schedule_campaign", {
    description: "Schedule a campaign for its eligible subscribers. Use null to send now or epoch milliseconds to send later. Use dryRun to preview, then confirm with campaign.updatedAt as expectedUpdatedAt and contentVersion as expectedContentVersion from that preview.",
    inputSchema: scheduleInput.extend({ ...mailbox.shape, ...campaignId }), annotations: send
  }, async args => {
    const ctx = await outreachAccount(args.accountId, "editor");
    return result(args.dryRun ? "Campaign preview" : "Campaign scheduled", await scheduleCampaign(await getOutreachDb(), actor(ctx), args.campaignId, args));
  });
  server.registerTool("cancel_campaign", {
    description: "Cancel remaining sends of a scheduled or running campaign.",
    inputSchema: mailbox.extend(campaignId), annotations: { ...edit, destructiveHint: true }
  }, async args => {
    const ctx = await outreachAccount(args.accountId, "editor");
    return result("Campaign cancelled", { ok: true, campaign: await cancelCampaign(await getOutreachDb(), actor(ctx), args.campaignId) });
  });

  server.registerTool("list_sequences", { description: "List email sequences with their status and statistics.", inputSchema: mailbox, annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Sequences", { ok: true, sequences: await listSequences(await getOutreachDb(), accountId) });
  });
  server.registerTool("get_sequence", { description: "Read an email sequence and its steps.", inputSchema: mailbox.extend(sequenceId), annotations: readOnly }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    return result("Sequence", { ok: true, sequence: getSequence(await getOutreachDb(), accountId, args.sequenceId) });
  });
  server.registerTool("save_sequence", {
    description: "Create or edit an email sequence. A steps array replaces the whole list, in order. Include existing step ids to retain them.",
    inputSchema: sequenceInput.extend({ ...mailbox.shape, sequenceId: itemId.optional() }), annotations: edit
  }, async ({ accountId: requested, sequenceId, ...input }) => {
    const { accountId } = await outreachAccount(requested, "editor");
    const db = await getOutreachDb();
    const sequence = sequenceId ? await editSequence(db, accountId, sequenceId, input) : saveSequence(db, accountId, input);
    return result("Sequence saved", { ok: true, sequence });
  });
  server.registerTool("set_sequence_status", {
    description: "Set a sequence live or pause it. Going live enables automatic sends to new subscribers on the trigger list and resumes overdue sends.",
    inputSchema: statusInput.extend({ ...mailbox.shape, ...sequenceId }), annotations: send
  }, async args => {
    const ctx = await outreachAccount(args.accountId, "editor");
    return result("Sequence status saved", { ok: true, sequence: await setSequenceStatus(await getOutreachDb(), actor(ctx), args.sequenceId, args.status, args.expectedUpdatedAt) });
  });
}
