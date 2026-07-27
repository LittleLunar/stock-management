import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useProductByBarcode } from "../hooks/masters";
import { formatApiError } from "../lib/errors";

type Props = {
  onProduct: (productId: string) => void;
  placeholder?: string;
};

/**
 * Scan / type a barcode; lookup on Enter or blur.
 * Uses a div (not form) so it can sit inside document create forms.
 */
export function BarcodeScanField({ onProduct, placeholder }: Props) {
  const [code, setCode] = useState("");
  const lookup = useProductByBarcode();

  async function lookupCode() {
    const trimmed = code.trim();
    if (!trimmed || lookup.isPending) return;
    try {
      const product = await lookup.mutateAsync(trimmed);
      onProduct(product.id);
      setCode("");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void lookupCode();
  }

  function onBlur(_event: FocusEvent<HTMLInputElement>) {
    void lookupCode();
  }

  return (
    <div className="flex gap-2">
      <input
        aria-label="Scan barcode"
        className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2"
        value={code}
        placeholder={placeholder ?? "Scan barcode…"}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoComplete="off"
      />
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        disabled={lookup.isPending}
        onClick={() => void lookupCode()}
      >
        Find
      </button>
    </div>
  );
}
