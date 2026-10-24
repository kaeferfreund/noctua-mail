// provisional, replaced by feat/push-server
/** Per-device push settings (briefs/web-push/_contract.md). */
export type PushDeviceSettings = {
  accountIds: "all" | string[];
  includeSubject: boolean;
  quietHours: { from: string; to: string; timeZone: string } | null;
  badge: boolean;
};
