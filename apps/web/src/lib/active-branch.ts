export function branchIdForHeaders(
  activeBranchId: string,
): string | undefined {
  const t = activeBranchId.trim();
  return t.length > 0 ? t : undefined;
}
