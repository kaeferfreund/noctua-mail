"use client";

import { useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/app/components/ui/sidebar";
import { isOutreachEnabledFor, useOutreachStatus } from "../useOutreachStatus";
import { outreachPageHref } from "./location";

/** The sidebar's one „Newsletter“ row: rendered only when the addon is activated for the mailbox. */
export default function OutreachNavEntry({ accountId }: { accountId: string }) {
  const t = useTranslations("outreach");
  const status = useOutreachStatus();
  if (!isOutreachEnabledFor(status, accountId)) return null;
  return (
    <SidebarMenu className="mt-2">
      <SidebarMenuItem>
        <SidebarMenuButton asChild className="max-md:h-11">
          <a href={outreachPageHref(accountId)} data-shell-action="newsletter"><Megaphone /><span>{t("title")}</span></a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
