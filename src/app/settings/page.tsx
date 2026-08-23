import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Database info, export and maintenance.</p>
      </div>
      <SettingsClient />
    </div>
  );
}
