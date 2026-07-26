import {
  BranchUseCases,
  CategoryUseCases,
  GoodsReceiptUseCases,
  LocationUseCases,
  OrganizationUseCases,
  PostGoodsReceipt,
  PostStockAdjustment,
  PostStockCount,
  PostStockIssue,
  ProductUseCases,
  PurchaseOrderUseCases,
  ReceiveStockTransfer,
  ShipStockTransfer,
  StockAdjustmentUseCases,
  StockCountUseCases,
  StockInquiryUseCases,
  StockIssueUseCases,
  StockTransferUseCases,
  SupplierUseCases,
  UsersUseCases,
  VoidGoodsReceipt,
  VoidStockAdjustment,
  VoidStockCount,
  VoidStockIssue,
  VoidStockTransfer,
} from "@stock-management/application";
import type { Db } from "../infrastructure/db/client.js";
import { DrizzleBranchRepository } from "../infrastructure/persistence/branch.repository.js";
import { DrizzleCategoryRepository } from "../infrastructure/persistence/category.repository.js";
import { DrizzleGoodsReceiptRepository } from "../infrastructure/persistence/goods-receipt.repository.js";
import { DrizzleLocationRepository } from "../infrastructure/persistence/location.repository.js";
import { DrizzleLotRepository } from "../infrastructure/persistence/lot.repository.js";
import { DrizzleOrganizationRepository } from "../infrastructure/persistence/organization.repository.js";
import { DrizzleProductRepository } from "../infrastructure/persistence/product.repository.js";
import { DrizzlePurchaseOrderRepository } from "../infrastructure/persistence/purchase-order.repository.js";
import { DrizzleSerialRepository } from "../infrastructure/persistence/serial.repository.js";
import { DrizzleStockAdjustmentRepository } from "../infrastructure/persistence/stock-adjustment.repository.js";
import { DrizzleStockCountRepository } from "../infrastructure/persistence/stock-count.repository.js";
import { DrizzleStockIssueRepository } from "../infrastructure/persistence/stock-issue.repository.js";
import { DrizzleStockRepository } from "../infrastructure/persistence/stock.repository.js";
import { DrizzleStockTransferRepository } from "../infrastructure/persistence/stock-transfer.repository.js";
import { DrizzleSupplierRepository } from "../infrastructure/persistence/supplier.repository.js";
import { DrizzleUnitOfWork } from "../infrastructure/persistence/unit-of-work.js";
import { DrizzleUsersRepository } from "../infrastructure/persistence/users.repository.js";

export type AppServices = {
  org: OrganizationUseCases;
  branches: BranchUseCases;
  locations: LocationUseCases;
  categories: CategoryUseCases;
  products: ProductUseCases;
  suppliers: SupplierUseCases;
  users: UsersUseCases;
  purchaseOrders: PurchaseOrderUseCases;
  goodsReceipts: GoodsReceiptUseCases;
  postGoodsReceipt: PostGoodsReceipt;
  voidGoodsReceipt: VoidGoodsReceipt;
  stockInquiry: StockInquiryUseCases;
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
  const unitOfWork = new DrizzleUnitOfWork(db);

  return {
    org: new OrganizationUseCases(new DrizzleOrganizationRepository(db)),
    branches: new BranchUseCases(new DrizzleBranchRepository(db)),
    locations: new LocationUseCases(new DrizzleLocationRepository(db)),
    categories: new CategoryUseCases(new DrizzleCategoryRepository(db)),
    products: new ProductUseCases(new DrizzleProductRepository(db)),
    suppliers: new SupplierUseCases(new DrizzleSupplierRepository(db)),
    users: new UsersUseCases(new DrizzleUsersRepository(db)),
    purchaseOrders: new PurchaseOrderUseCases(purchaseOrders),
    goodsReceipts: new GoodsReceiptUseCases(goodsReceipts),
    postGoodsReceipt: new PostGoodsReceipt(unitOfWork),
    voidGoodsReceipt: new VoidGoodsReceipt(unitOfWork),
    stockInquiry: new StockInquiryUseCases(stock, lots, serials),
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
  };
}
