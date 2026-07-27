import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export function WorkspaceHome({ view }: { view: "Buyer" | "Supplier" }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{view}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{view} workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Your organization is ready for the next Movix workflow.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You’re all caught up. Notifications will appear here when action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
