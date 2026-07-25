# Domain model (explanation)

See also wiki: [[Domain Model]], [[Document-Driven Inventory]].

## Hierarchy

```
Organization
  └── Branch
        └── Location
```

## Stock truth

| Concept | Role |
|---------|------|
| Product | SKU + tracking/costing flags — **no qty** |
| Lot / Serial | Traceability |
| StockBalance | qty_on_hand, qty_reserved per product+location+lot |
| StockMovement | Immutable ledger |
| StockReservation | Soft allocate for POS/orders |

## Documents

PurchaseOrder, GoodsReceipt, StockIssue, StockTransfer, StockAdjustment, StockCount, returns.

States: `draft` → `posted` → `void` (transfers: + `in_transit` → `received`).

## Costing

`CostLayer` + `CostConsumption` (FIFO). Optional landed cost docs.

## Accounting

Account, AccountingPeriod, JournalEntry/Line, SupplierInvoice, InvoiceMatch, AccountMapping.

## Integration

ExternalReference, OutboxEvent, IdempotencyKey.

Full table sketch from planning lives in the product vision source and will become `docs/reference/schema.md` when migrations land.
