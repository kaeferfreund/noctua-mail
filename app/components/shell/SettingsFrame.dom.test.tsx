import { afterEach, beforeEach, expect, it } from "bun:test";
import { useState } from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import SettingsFrame, { SettingsTitle } from "./SettingsFrame";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import { DIALOG_LAYERS } from "@/app/components/ui/dialogLayers";
let viewportWidth: number;
beforeEach(() => { viewportWidth = window.innerWidth; });
afterEach(() => { cleanup(); window.innerWidth = viewportWidth; });
function Harness() {
  const [frame, setFrame] = useState(false), [members, setMembers] = useState(false), [confirm, setConfirm] = useState(false);
  return <><button onClick={() => setFrame(true)}>Open settings</button>
    <SettingsFrame open={frame} onClose={() => setFrame(false)}><SettingsTitle>Settings</SettingsTitle>
      <button onClick={() => setFrame(false)}>Close settings</button><button onClick={() => setMembers(true)}>Manage members</button>
      <Dialog open={members} onOpenChange={setMembers}><DialogContent aria-describedby={undefined}><DialogTitle>Members</DialogTitle>
        <button onClick={() => setConfirm(true)}>Change member role</button>
        <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent aria-describedby={undefined}><DialogTitle>Confirm role</DialogTitle><button>Confirm</button></DialogContent></Dialog>
      </DialogContent></Dialog>
    </SettingsFrame></>;
}
it("QA-004/009 layers nested dialogs and closes only the top dialog, restoring each opener", async () => {
  window.innerWidth = 1440;
  const page = render(<Theme><Harness /></Theme>);
  const opener = page.getByRole("button", { name: "Open settings" }); opener.focus(); fireEvent.click(opener);
  const frame = await page.findByRole("dialog", { name: "Settings" });
  const manage = within(frame).getByRole("button", { name: "Manage members" }); manage.focus(); fireEvent.click(manage);
  const members = await page.findByRole("dialog", { name: "Members" });
  expect(Number(members.style.zIndex)).toBe(DIALOG_LAYERS.settings + DIALOG_LAYERS.step);
  const change = within(members).getByRole("button", { name: "Change member role" }); change.focus(); fireEvent.click(change);
  const confirm = await page.findByRole("dialog", { name: "Confirm role" });
  expect(Number(confirm.style.zIndex)).toBe(Number(members.style.zIndex) + DIALOG_LAYERS.step);
  fireEvent.keyDown(confirm, { key: "Escape" });
  await waitFor(() => expect(page.queryByRole("dialog", { name: "Confirm role" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(change));
  expect(members.isConnected && frame.isConnected).toBe(true);
  fireEvent.keyDown(members, { key: "Escape" });
  await waitFor(() => expect(members.isConnected).toBe(false));
  await waitFor(() => expect(document.activeElement).toBe(manage));
  fireEvent.keyDown(frame, { key: "Escape" });
  await waitFor(() => expect(frame.isConnected).toBe(false));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
it("QA-009 preserves the Close button dismissal path and focus", async () => {
  window.innerWidth = 1440;
  const page = render(<Theme><Harness /></Theme>);
  const opener = page.getByRole("button", { name: "Open settings" }); opener.focus(); fireEvent.click(opener);
  await page.findByRole("dialog", { name: "Settings" }); fireEvent.click(page.getByRole("button", { name: "Close settings" }));
  await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
