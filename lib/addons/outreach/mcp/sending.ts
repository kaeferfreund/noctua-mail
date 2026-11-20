import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getOutreachDb } from "../db";
import { cancelCampaign, editSequence, editSequenceStep, scheduleCampaign, setSequenceStatus } from "../sending/actions";
import { campaignInput, itemId, scheduleInput, SendingError, sequenceEditInput, statusInput, stepEditInput, templateInput } from "../sending/input";
import {
  campaignReport, getCampaign, getSequence, getTemplate, listCampaigns, listSequences, listTemplates, required, saveCampaign,
  saveSequence, saveTemplate
} from "../sending/store";
import type { Sequence, SequenceStep } from "../types";
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
/** A step body is a whole HTML mail. A sequence is answered with the bodies' lengths; `get_sequence_step` answers one step in full. */
const stepOutline = ({ html, text, ...step }: SequenceStep) => ({ ...step, htmlLength: html.length, textLength: text.length });
const sequenceOutline = (sequence: Sequence) => ({ ...sequence, steps: sequence.steps.map(stepOutline) });
const liveEdit = "Editing a sequence that is live or paused approves the new content for sending like going live: it needs the token's send permission, the change goes out with the next mail, and the token's creator becomes the sequence's approver. A version conflict answers an error that starts with \"sequence_changed:\": read the sequence again.";

/** A refusal with a code reaches the client as "<code>: <message>", so a client tells a conflict (`sequence_changed`) from other refusals. */
function refusalCodes<T extends (...args: never[]) => unknown>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      throw error instanceof SendingError && error.code ? new Error(`${error.code}: ${error.message}`) : error;
    }
  }) as T;
}

export function registerOutreachSendingTools(host: OutreachMcpHost) {
  const { outreachAccount, result } = host;
  const server: Pick<McpServer, "registerTool"> = {
    registerTool: (name, config, handler) => host.server.registerTool(name, config, refusalCodes(handler))
  };
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
  server.registerTool("get_sequence", {
    description: "Read an email sequence and its steps. The steps come without html and text, with their lengths: read one step with get_sequence_step, or set includeBodies for all of them (large).",
    inputSchema: mailbox.extend({ ...sequenceId, includeBodies: z.boolean().optional() }), annotations: readOnly
  }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    const sequence = getSequence(await getOutreachDb(), accountId, args.sequenceId);
    return result("Sequence", { ok: true, sequence: args.includeBodies ? sequence : sequenceOutline(sequence) });
  });
  server.registerTool("get_sequence_step", {
    description: "Read one step of an email sequence with its HTML and text. Answers the sequence's status and updatedAt for update_sequence_step.",
    inputSchema: mailbox.extend({ ...sequenceId, stepId: itemId }), annotations: readOnly
  }, async args => {
    const { accountId } = await outreachAccount(args.accountId, "viewer");
    const { id, name, status, updatedAt, steps } = getSequence(await getOutreachDb(), accountId, args.sequenceId);
    return result("Sequence step", { ok: true, sequence: { id, name, status, updatedAt }, step: required(steps.find(step => step.id === args.stepId)) });
  });
  server.registerTool("save_sequence", {
    description: `Create or edit an email sequence. A steps array replaces the whole list, in order: include every step to keep with its id; a step without id is new, a step left out is deleted. To change one step's content use update_sequence_step. ${liveEdit} It also needs the sequence's updatedAt as expectedUpdatedAt.`,
    inputSchema: sequenceEditInput.extend({ ...mailbox.shape, sequenceId: itemId.optional() }), annotations: edit
  }, async ({ accountId: requested, sequenceId, expectedUpdatedAt, ...input }) => {
    const ctx = await outreachAccount(requested, "editor");
    const db = await getOutreachDb();
    const sequence = sequenceId ? await editSequence(db, actor(ctx), sequenceId, input, { expectedUpdatedAt })
      : saveSequence(db, ctx.accountId, input);
    return result("Sequence saved", { ok: true, sequence: sequenceOutline(sequence) });
  });
  server.registerTool("update_sequence_step", {
    description: `Change the content of one step of an email sequence and nothing else: name, subject, previewText, html and text as whole fields, then replacements of exact text inside a field (find must occur exactly once, counting non-overlapping matches, or set replaceAll). Placeholders are stored as {{ name }} (with spaces) and find matches the text as stored, as get_sequence_step shows it. Pass the sequence's updatedAt as expectedUpdatedAt. dryRun runs every check and answers without saving. changed and step describe the content as it would be stored; warnings come from rendering it. ${liveEdit}`,
    inputSchema: stepEditInput.extend({ ...mailbox.shape, ...sequenceId, stepId: itemId }), annotations: edit
  }, async ({ accountId: requested, sequenceId, stepId, expectedUpdatedAt, dryRun, ...change }) => {
    const ctx = await outreachAccount(requested, "editor");
    const { sequence, step, ...outcome } = await editSequenceStep(await getOutreachDb(), actor(ctx), sequenceId, stepId, change,
      { expectedUpdatedAt, dryRun });
    return result(outcome.saved ? "Sequence step saved" : "Sequence step not saved", { ok: true, ...outcome,
      sequence: { id: sequence.id, name: sequence.name, status: sequence.status, updatedAt: sequence.updatedAt }, step: stepOutline(step) });
  });
  server.registerTool("set_sequence_status", {
    description: "Set a sequence live or pause it. Going live enables automatic sends to new subscribers on the trigger list and resumes overdue sends.",
    inputSchema: statusInput.extend({ ...mailbox.shape, ...sequenceId }), annotations: send
  }, async args => {
    const ctx = await outreachAccount(args.accountId, "editor");
    const sequence = await setSequenceStatus(await getOutreachDb(), actor(ctx), args.sequenceId, args.status, args.expectedUpdatedAt);
    return result("Sequence status saved", { ok: true, sequence: sequenceOutline(sequence) });
  });
}
