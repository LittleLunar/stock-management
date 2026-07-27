import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreateCostRevaluation } from "@stock-management/shared";
import { useBranches } from "../hooks/masters";
import {
  useCostRevaluations,
  useCreateCostRevaluation,
  usePostCostRevaluation,
  useVoidCostRevaluation,
} from "../hooks/costing";
import { formatApiError } from "../lib/errors";

type Doc = {
  id: string;
  status: string;
  reasonCode: string;
  branchId: string;
};

export function CostRevaluationsPage() {
  const { t } = useTranslation("costing");
  const { data: branches } = useBranches();
  const list = useCostRevaluations();
  const create = useCreateCostRevaluation();
  const post = usePostCostRevaluation();
  const voidDoc = useVoidCostRevaluation();
  const [branchId, setBranchId] = useState("");
  const [reasonCode, setReasonCode] = useState("write_down");
  const [costLayerId, setCostLayerId] = useState("");
  const [newUnitCost, setNewUnitCost] = useState("");
  const docs = (list.data ?? []) as Doc[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("costing.costRevaluations.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("costing.costRevaluations.description")}
        </p>
      </div>
      <form
        className="space-y-3 rounded border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branchId || !costLayerId || !newUnitCost) return;
          const body: CreateCostRevaluation = {
            branchId,
            reasonCode,
            lines: [{ costLayerId, newUnitCost }],
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
            <option value="">{t("costing.costRevaluations.branch")}</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2"
            placeholder={t("costing.costRevaluations.reasonCodePlaceholder")}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            placeholder={t("costing.costRevaluations.costLayerIdPlaceholder")}
            value={costLayerId}
            onChange={(e) => setCostLayerId(e.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            placeholder={t("costing.costRevaluations.newUnitCostPlaceholder")}
            value={newUnitCost}
            onChange={(e) => setNewUnitCost(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-white"
          >
            {t("costing.costRevaluations.createDraft")}
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
              {doc.reasonCode} · {doc.status}
            </span>
            {doc.status === "draft" ? (
              <button
                className="rounded border px-2 py-1"
                onClick={() => post.mutate(doc.id)}
              >
                {t("costing.costRevaluations.post")}
              </button>
            ) : null}
            {doc.status === "posted" ? (
              <button
                className="rounded border px-2 py-1"
                onClick={() => voidDoc.mutate(doc.id)}
              >
                {t("costing.costRevaluations.void")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
