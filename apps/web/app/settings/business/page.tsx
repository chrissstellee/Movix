import { BusinessSettings } from "@/features/settings/business-settings";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function BusinessSettingsPage() {
  return (
    <WorkspaceShell>
      <BusinessSettings />
    </WorkspaceShell>
  );
}
