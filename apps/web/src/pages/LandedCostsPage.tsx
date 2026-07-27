import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreateLandedCost } from "@stock-management/shared";
import { useBranches } from "../hooks/masters";
import {
  useCreateLandedCost,
  useLandedCosts,
  usePostLandedCost,
  useVoidLandedCost,
} from "../hooks/costing";
import { formatApiError } from "../lib/errors";

type Doc = {
  id: string;
  status: string;
  costType: string;
  totalAmount: string;
  branchId: string;
};

export function LandedCostsPage() {
  const { t } = useTranslation("costing");
  const { data: branches } = useBranches();
  const list = useLandedCosts();
  const create = useCreateLandedCost();
  const post = usePostLandedCost();
  const voidDoc = useVoidLandedCost();
  const [branchId, setBranchId] = useState("");
  const [costType, setCostType] = useState<"freight" | "duty" | "other">(
    "freight",
  );
  const [totalAmount, setTotalAmount] = useState("");
  const [costLayerId, setCostLayerId] = useState("");
  const docs = (list.data ?? []) as Doc[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("costing.landedCosts.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("costing.landedCosts.description")}
        </p>
      </div>
      <form
        className="space-y-3 rounded border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branchId || !totalAmount || !costLayerId) return;
          const body: CreateLandedCost = {
            branchId,
            costType,
            totalAmount,
            lines: [{ costLayerId, amount: totalAmount }],
          };
          create.mutate(body);
        }}
      >
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded border px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
          >
            <option value="">{t("costing.landedCosts.branch")}</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2"
            value={costType}
            onChange={(e) =>
              setCostType(e.target.value as "freight" | "duty" | "other")
            }
          >
            <option value="freight">
              {t("costing.landedCosts.costType.freight")}
            </option>
            <option value="duty">
              {t("costing.landedCosts.costType.duty")}
            </option>
            <option value="other">
              {t("costing.landedCosts.costType.other")}
            </option>
          </select>
          <input
            className="rounded border px-3 py-2"
            placeholder={t("costing.landedCosts.totalAmountPlaceholder")}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            placeholder={t("costing.landedCosts.costLayerIdPlaceholder")}
            value={costLayerId}
            onChange={(e) => setCostLayerId(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-white"
          >
            {t("costing.landedCosts.createDraft")}
          </button>
        </div>
      </form>
      {list.error ? (
        <p className="text-red-700">{formatApiError(list.error)}</p>
      ) : null}
      <ul className="space-y-2">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-wrap items-center gap-3 rounded border bg-white p-3 text-sm"
          >
            <span>
              {doc.costType} · {doc.totalAmount} · {doc.status}
            </span>
            {doc.status === "draft" ? (
              <button
                className="rounded border px-2 py-1"
                onClick={() => post.mutate(doc.id)}
              >
                {t("costing.landedCosts.post")}
              </button>
            ) : null}
            {doc.status === "posted" ? (
              <button
                className="rounded border px-2 py-1"
                onClick={() => voidDoc.mutate(doc.id)}
              >
                {t("costing.landedCosts.void")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
