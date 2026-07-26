export function costingOutboxFields(input: {
  inventoryValueDelta?: string;
  cogsTotal?: string;
  landedAmount?: string;
  revaluationValueDelta?: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (input.inventoryValueDelta !== undefined) {
    out.inventoryValueDelta = input.inventoryValueDelta;
  }
  if (input.cogsTotal !== undefined) {
    out.cogsTotal = input.cogsTotal;
  }
  if (input.landedAmount !== undefined) {
    out.landedAmount = input.landedAmount;
  }
  if (input.revaluationValueDelta !== undefined) {
    out.revaluationValueDelta = input.revaluationValueDelta;
  }
  return out;
}
