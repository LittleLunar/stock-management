import {
  AccountUseCases,
  AccountingPeriodUseCases,
  AvailabilityUseCases,
  BranchUseCases,
  CategoryUseCases,
  CogsReportUseCases,
  CostInquiryUseCases,
  CostRevaluationUseCases,
  CustomerReturnUseCases,
  CustomerUseCases,
  CommitReservation,
  type MembershipAccessPort,
  EnsureDefaultChartOfAccounts,
  GoodsReceiptUseCases,
  JournalUseCases,
  LandedCostUseCases,
  LocationUseCases,
  OrganizationUseCases,
  PostCostRevaluation,
  PostCustomerReturn,
  PostGoodsReceipt,
  PostLandedCost,
  PostStockAdjustment,
  PostStockCount,
  PostStockIssue,
  PostSupplierReturn,
  ProcessOutboxForJournals,
  ProductUseCases,
  PurchaseOrderUseCases,
  ReceiveStockTransfer,
  ReleaseReservation,
  ReservationUseCases,
  ShipStockTransfer,
  StockAdjustmentUseCases,
  StockCountUseCases,
  StockInquiryUseCases,
  StockIssueUseCases,
  StockTransferUseCases,
  SupplierReturnUseCases,
  SupplierUseCases,
  UsersUseCases,
  ValuationReportUseCases,
  VoidCostRevaluation,
  VoidCustomerReturn,
  VoidGoodsReceipt,
  VoidLandedCost,
  VoidStockAdjustment,
  VoidStockCount,
  VoidStockIssue,
  VoidStockTransfer,
  VoidSupplierReturn,
  SupplierInvoiceUseCases,
  PostSupplierInvoice,
  VoidSupplierInvoice,
  ApAgingReportUseCase,
  BalanceSheetUseCase,
  PeriodCloseChecklistUseCase,
  PnlReportUseCase,
  TrialBalanceUseCase,
} from "@stock-management/application";
import { NotFoundError } from "@stock-management/domain";
import type { Db } from "../infrastructure/db/client.js";
import { DrizzleCloseChecklistRepository } from "../infrastructure/persistence/close-checklist.repository.js";
import { DrizzleAccountingRepository } from "../infrastructure/persistence/accounting.repository.js";
import { DrizzleApRepository } from "../infrastructure/persistence/ap.repository.js";
import { DrizzleApprovalPolicyRepository } from "../infrastructure/persistence/approval-policy.repository.js";
import { DrizzleBranchRepository } from "../infrastructure/persistence/branch.repository.js";
import { DrizzleCategoryRepository } from "../infrastructure/persistence/category.repository.js";
import { DrizzleCogsMovementSource } from "../infrastructure/persistence/cogs-movement.repository.js";
import { DrizzleCostingRepository } from "../infrastructure/persistence/costing.repository.js";
import { DrizzleCostRevaluationRepository } from "../infrastructure/persistence/cost-revaluation.repository.js";
import { DrizzleCustomerRepository } from "../infrastructure/persistence/customer.repository.js";
import { DrizzleCustomerReturnRepository } from "../infrastructure/persistence/customer-return.repository.js";
import { DrizzleGoodsReceiptRepository } from "../infrastructure/persistence/goods-receipt.repository.js";
import { DrizzleLandedCostRepository } from "../infrastructure/persistence/landed-cost.repository.js";
import { DrizzleLocationRepository } from "../infrastructure/persistence/location.repository.js";
import { DrizzleLotRepository } from "../infrastructure/persistence/lot.repository.js";
import { DrizzleOrganizationRepository } from "../infrastructure/persistence/organization.repository.js";
import { DrizzleProductRepository } from "../infrastructure/persistence/product.repository.js";
import { DrizzlePurchaseOrderRepository } from "../infrastructure/persistence/purchase-order.repository.js";
import { DrizzleReservationRepository } from "../infrastructure/persistence/reservation.repository.js";
import { DrizzleSerialRepository } from "../infrastructure/persistence/serial.repository.js";
import { DrizzleStockAdjustmentRepository } from "../infrastructure/persistence/stock-adjustment.repository.js";
import { DrizzleStockCountRepository } from "../infrastructure/persistence/stock-count.repository.js";
import { DrizzleStockIssueRepository } from "../infrastructure/persistence/stock-issue.repository.js";
import { DrizzleStockRepository } from "../infrastructure/persistence/stock.repository.js";
import { DrizzleStockTransferRepository } from "../infrastructure/persistence/stock-transfer.repository.js";
import { DrizzleSupplierRepository } from "../infrastructure/persistence/supplier.repository.js";
import { DrizzleSupplierReturnRepository } from "../infrastructure/persistence/supplier-return.repository.js";
import { DrizzleUnitOfWork } from "../infrastructure/persistence/unit-of-work.js";
import { DrizzleUsersRepository } from "../infrastructure/persistence/users.repository.js";

export type AppServices = {
  org: OrganizationUseCases;
  branches: BranchUseCases;
  locations: LocationUseCases;
  categories: CategoryUseCases;
  products: ProductUseCases;
  suppliers: SupplierUseCases;
  customers: CustomerUseCases;
  users: UsersUseCases;
  membershipAccess: MembershipAccessPort;
  purchaseOrders: PurchaseOrderUseCases;
  goodsReceipts: GoodsReceiptUseCases;
  postGoodsReceipt: PostGoodsReceipt;
  voidGoodsReceipt: VoidGoodsReceipt;
  stockInquiry: StockInquiryUseCases;
  costInquiry: CostInquiryUseCases;
  stockIssues: StockIssueUseCases;
  postStockIssue: PostStockIssue;
  voidStockIssue: VoidStockIssue;
  stockTransfers: StockTransferUseCases;
  shipStockTransfer: ShipStockTransfer;
  receiveStockTransfer: ReceiveStockTransfer;
  voidStockTransfer: VoidStockTransfer;
  stockAdjustments: StockAdjustmentUseCases;
  postStockAdjustment: PostStockAdjustment;
  voidStockAdjustment: VoidStockAdjustment;
  stockCounts: StockCountUseCases;
  postStockCount: PostStockCount;
  voidStockCount: VoidStockCount;
  reservations: ReservationUseCases;
  releaseReservation: ReleaseReservation;
  commitReservation: CommitReservation;
  availability: AvailabilityUseCases;
  supplierReturns: SupplierReturnUseCases;
  postSupplierReturn: PostSupplierReturn;
  voidSupplierReturn: VoidSupplierReturn;
  customerReturns: CustomerReturnUseCases;
  postCustomerReturn: PostCustomerReturn;
  voidCustomerReturn: VoidCustomerReturn;
  landedCosts: LandedCostUseCases;
  postLandedCost: PostLandedCost;
  voidLandedCost: VoidLandedCost;
  costRevaluations: CostRevaluationUseCases;
  postCostRevaluation: PostCostRevaluation;
  voidCostRevaluation: VoidCostRevaluation;
  valuationReport: ValuationReportUseCases;
  cogsReport: CogsReportUseCases;
  costing: DrizzleCostingRepository;
  ensureDefaultChartOfAccounts: EnsureDefaultChartOfAccounts;
  accountingPeriods: AccountingPeriodUseCases;
  accounts: AccountUseCases;
  journals: JournalUseCases;
  processOutboxForJournals: ProcessOutboxForJournals;
  accounting: DrizzleAccountingRepository;
  supplierInvoices: SupplierInvoiceUseCases;
  postSupplierInvoice: PostSupplierInvoice;
  voidSupplierInvoice: VoidSupplierInvoice;
  apAging: ApAgingReportUseCase;
  trialBalance: TrialBalanceUseCase;
  pnlReport: PnlReportUseCase;
  balanceSheet: BalanceSheetUseCase;
  periodCloseChecklist: PeriodCloseChecklistUseCase;
  approvalPolicies: DrizzleApprovalPolicyRepository;
};

/** Composition root: wire infrastructure adapters to application use cases. */
export function createAppServices(db: Db): AppServices {
  const purchaseOrders = new DrizzlePurchaseOrderRepository(db);
  const goodsReceipts = new DrizzleGoodsReceiptRepository(db);
  const stock = new DrizzleStockRepository(db);
  const lots = new DrizzleLotRepository(db);
  const serials = new DrizzleSerialRepository(db);
  const stockIssues = new DrizzleStockIssueRepository(db);
  const stockTransfers = new DrizzleStockTransferRepository(db);
  const stockAdjustments = new DrizzleStockAdjustmentRepository(db);
  const stockCounts = new DrizzleStockCountRepository(db);
  const customers = new DrizzleCustomerRepository(db);
  const reservations = new DrizzleReservationRepository(db);
  const supplierReturns = new DrizzleSupplierReturnRepository(db);
  const customerReturns = new DrizzleCustomerReturnRepository(db);
  const locations = new DrizzleLocationRepository(db);
  const landedCosts = new DrizzleLandedCostRepository(db);
  const costRevaluations = new DrizzleCostRevaluationRepository(db);
  const costing = new DrizzleCostingRepository(db);
  const accounting = new DrizzleAccountingRepository(db);
  const ap = new DrizzleApRepository(db);
  const closeChecklist = new DrizzleCloseChecklistRepository(db);
  const orgRepo = new DrizzleOrganizationRepository(db);
  const usersRepo = new DrizzleUsersRepository(db);
  const unitOfWork = new DrizzleUnitOfWork(db);
  const ensureDefaultChartOfAccounts = new EnsureDefaultChartOfAccounts(
    accounting,
  );

  return {
    org: new OrganizationUseCases(orgRepo),
    branches: new BranchUseCases(new DrizzleBranchRepository(db)),
    locations: new LocationUseCases(locations),
    categories: new CategoryUseCases(new DrizzleCategoryRepository(db)),
    products: new ProductUseCases(new DrizzleProductRepository(db)),
    suppliers: new SupplierUseCases(new DrizzleSupplierRepository(db)),
    customers: new CustomerUseCases(customers),
    users: new UsersUseCases(usersRepo),
    membershipAccess: usersRepo,
    purchaseOrders: new PurchaseOrderUseCases(purchaseOrders),
    goodsReceipts: new GoodsReceiptUseCases(goodsReceipts),
    postGoodsReceipt: new PostGoodsReceipt(unitOfWork),
    voidGoodsReceipt: new VoidGoodsReceipt(unitOfWork),
    stockInquiry: new StockInquiryUseCases(stock, lots, serials),
    costInquiry: new CostInquiryUseCases(unitOfWork),
    stockIssues: new StockIssueUseCases(stockIssues),
    postStockIssue: new PostStockIssue(unitOfWork),
    voidStockIssue: new VoidStockIssue(unitOfWork),
    stockTransfers: new StockTransferUseCases(stockTransfers),
    shipStockTransfer: new ShipStockTransfer(unitOfWork),
    receiveStockTransfer: new ReceiveStockTransfer(unitOfWork),
    voidStockTransfer: new VoidStockTransfer(unitOfWork),
    stockAdjustments: new StockAdjustmentUseCases(stockAdjustments),
    postStockAdjustment: new PostStockAdjustment(unitOfWork),
    voidStockAdjustment: new VoidStockAdjustment(unitOfWork),
    stockCounts: new StockCountUseCases(stockCounts, stock),
    postStockCount: new PostStockCount(unitOfWork),
    voidStockCount: new VoidStockCount(unitOfWork),
    reservations: new ReservationUseCases(reservations, unitOfWork),
    releaseReservation: new ReleaseReservation(unitOfWork),
    commitReservation: new CommitReservation(unitOfWork),
    availability: new AvailabilityUseCases(stock, reservations, locations),
    supplierReturns: new SupplierReturnUseCases(supplierReturns),
    postSupplierReturn: new PostSupplierReturn(unitOfWork),
    voidSupplierReturn: new VoidSupplierReturn(unitOfWork),
    customerReturns: new CustomerReturnUseCases(customerReturns),
    postCustomerReturn: new PostCustomerReturn(unitOfWork),
    voidCustomerReturn: new VoidCustomerReturn(unitOfWork),
    landedCosts: new LandedCostUseCases(landedCosts),
    postLandedCost: new PostLandedCost(unitOfWork),
    voidLandedCost: new VoidLandedCost(unitOfWork),
    costRevaluations: new CostRevaluationUseCases(costRevaluations),
    postCostRevaluation: new PostCostRevaluation(unitOfWork),
    voidCostRevaluation: new VoidCostRevaluation(unitOfWork),
    valuationReport: new ValuationReportUseCases(costing, locations),
    cogsReport: new CogsReportUseCases(new DrizzleCogsMovementSource(db)),
    costing,
    ensureDefaultChartOfAccounts,
    accountingPeriods: new AccountingPeriodUseCases(
      accounting,
      async (orgId) => {
        const org = await orgRepo.findById(orgId);
        if (!org) throw new NotFoundError("Organization");
        return org.fiscalYearStartMonth;
      },
    ),
    accounts: new AccountUseCases(accounting),
    journals: new JournalUseCases(accounting),
    processOutboxForJournals: new ProcessOutboxForJournals(
      accounting,
      ensureDefaultChartOfAccounts,
    ),
    accounting,
    supplierInvoices: new SupplierInvoiceUseCases(ap),
    postSupplierInvoice: new PostSupplierInvoice(
      unitOfWork,
      ensureDefaultChartOfAccounts,
    ),
    voidSupplierInvoice: new VoidSupplierInvoice(
      unitOfWork,
      ensureDefaultChartOfAccounts,
    ),
    apAging: new ApAgingReportUseCase(ap),
    trialBalance: new TrialBalanceUseCase(accounting),
    pnlReport: new PnlReportUseCase(accounting),
    balanceSheet: new BalanceSheetUseCase(accounting),
    periodCloseChecklist: new PeriodCloseChecklistUseCase(
      accounting,
      closeChecklist,
    ),
    approvalPolicies: new DrizzleApprovalPolicyRepository(db),
  };
}
