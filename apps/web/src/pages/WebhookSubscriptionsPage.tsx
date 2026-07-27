import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useBranches } from "../hooks/masters";
import {
  useCreateWebhookSubscription,
  usePatchWebhookSubscription,
  useWebhookDeliveries,
  useWebhookSubscriptions,
} from "../hooks/webhooks";
import { formatDateTime } from "../i18n/format";
import { formatApiError } from "../lib/errors";

export function WebhookSubscriptionsPage() {
  const { t } = useTranslation("settings");
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
      .map((item) => item.trim())
      .filter(Boolean);
    if (!url || !secret || types.length === 0) {
      toast.error(t("settings.webhooks.selectRequired"));
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
          toast.success(t("settings.webhooks.createSuccess"));
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
        <h1 className="text-2xl font-semibold">{t("settings.webhooks.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.webhooks.description")}
        </p>
      </div>

      <form
        className="space-y-4 rounded border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="font-semibold">{t("settings.webhooks.newTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            type="url"
            className="rounded border border-slate-300 px-3 py-2"
            placeholder={t("settings.webhooks.urlPlaceholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            required
            minLength={8}
            className="rounded border border-slate-300 px-3 py-2"
            placeholder={t("settings.webhooks.secretPlaceholder")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <input
            required
            className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
            placeholder={t("settings.webhooks.eventTypesPlaceholder")}
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">{t("settings.webhooks.allBranches")}</option>
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
            {t("settings.webhooks.active")}
          </label>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {create.isPending
            ? t("settings.webhooks.creating")
            : t("settings.webhooks.create")}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("settings.webhooks.listTitle")}</h2>
        {isLoading ? <p>{t("settings.webhooks.loading")}</p> : null}
        {error ? <p className="text-red-700">{formatApiError(error)}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("settings.webhooks.col.url")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.events")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.branch")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.active")}</th>
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
                      : t("settings.webhooks.branchAll")}
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
                                    ? t("settings.webhooks.activateSuccess")
                                    : t("settings.webhooks.deactivateSuccess"),
                                ),
                              onError: (err) =>
                                toast.error(formatApiError(err)),
                            },
                          )
                        }
                      />
                      {sub.active
                        ? t("settings.webhooks.on")
                        : t("settings.webhooks.off")}
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
                    {t("settings.webhooks.emptySubscriptions")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("settings.webhooks.deliveriesTitle")}</h2>
        {deliveriesLoading ? <p>{t("settings.webhooks.loading")}</p> : null}
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("settings.webhooks.col.delivery")}</th>
                <th className="px-4 py-3">
                  {t("settings.webhooks.col.subscription")}
                </th>
                <th className="px-4 py-3">{t("settings.webhooks.col.status")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.http")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.error")}</th>
                <th className="px-4 py-3">{t("settings.webhooks.col.created")}</th>
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
                    {formatDateTime(
                      typeof d.createdAt === "string"
                        ? d.createdAt
                        : String(d.createdAt),
                    )}
                  </td>
                </tr>
              ))}
              {(deliveries ?? []).length === 0 && !deliveriesLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    {t("settings.webhooks.emptyDeliveries")}
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
