import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useBranches } from "../hooks/masters";
import {
  useCreateWebhookSubscription,
  usePatchWebhookSubscription,
  useWebhookDeliveries,
  useWebhookSubscriptions,
} from "../hooks/webhooks";
import { formatApiError } from "../lib/errors";

export function WebhookSubscriptionsPage() {
  const { data: branches } = useBranches();
  const { data: subscriptions, isLoading, error } = useWebhookSubscriptions();
  const { data: deliveries, isLoading: deliveriesLoading } =
    useWebhookDeliveries();
  const create = useCreateWebhookSubscription();
  const patch = usePatchWebhookSubscription();

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [eventTypes, setEventTypes] = useState("document.posted");
  const [branchId, setBranchId] = useState("");
  const [active, setActive] = useState(true);

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const types = eventTypes
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!url || !secret || types.length === 0) {
      toast.error("URL, secret (min 8), and at least one event type required");
      return;
    }
    create.mutate(
      {
        url,
        secret,
        eventTypes: types,
        branchId: branchId || null,
        active,
      },
      {
        onSuccess: () => {
          toast.success("Webhook subscription created");
          setUrl("");
          setSecret("");
          setEventTypes("document.posted");
          setBranchId("");
          setActive(true);
        },
        onError: (err) => toast.error(formatApiError(err)),
      },
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Webhook subscriptions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Org admins only. Deliver signed outbox events to an HTTPS endpoint.
          Common event types:{" "}
          <code className="text-xs">document.posted</code>,{" "}
          <code className="text-xs">document.voided</code>,{" "}
          <code className="text-xs">stock.changed</code>.
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">New subscription</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            type="url"
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="https://example.com/hooks"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            required
            minLength={8}
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Signing secret (min 8)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <input
            required
            className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
            placeholder="Event types (comma-separated)"
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All branches</option>
            {(branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "Create subscription"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Subscriptions</h2>
        {isLoading ? <p>Loading…</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(subscriptions ?? []).map((sub) => (
                <tr key={sub.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium">
                    {sub.url}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {sub.eventTypes.join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    {sub.branchId
                      ? (branches?.find((b) => b.id === sub.branchId)?.code ??
                        sub.branchId.slice(0, 8))
                      : "All"}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={sub.active}
                        disabled={patch.isPending}
                        onChange={(e) =>
                          patch.mutate(
                            { id: sub.id, body: { active: e.target.checked } },
                            {
                              onSuccess: () =>
                                toast.success(
                                  e.target.checked
                                    ? "Subscription activated"
                                    : "Subscription deactivated",
                                ),
                              onError: (err) =>
                                toast.error(formatApiError(err)),
                            },
                          )
                        }
                      />
                      {sub.active ? "On" : "Off"}
                    </label>
                  </td>
                </tr>
              ))}
              {(subscriptions ?? []).length === 0 && !isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No subscriptions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Recent deliveries</h2>
        {deliveriesLoading ? <p>Loading…</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">HTTP</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(deliveries ?? []).map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">
                    {d.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {d.subscriptionId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{d.status}</td>
                  <td className="px-4 py-3">{d.httpStatus ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-red-700">
                    {d.error ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {typeof d.createdAt === "string"
                      ? d.createdAt
                      : String(d.createdAt)}
                  </td>
                </tr>
              ))}
              {(deliveries ?? []).length === 0 && !deliveriesLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No deliveries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
