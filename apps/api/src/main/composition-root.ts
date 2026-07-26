import {
  BranchUseCases,
  CategoryUseCases,
  GoodsReceiptUseCases,
  LocationUseCases,
  OrganizationUseCases,
  PostGoodsReceipt,
  ProductUseCases,
  PurchaseOrderUseCases,
  StockInquiryUseCases,
  SupplierUseCases,
  UsersUseCases,
  VoidGoodsReceipt,
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
import { DrizzleStockRepository } from "../infrastructure/persistence/stock.repository.js";
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
};

/** Composition root: wire infrastructure adapters to application use cases. */
export function createAppServices(db: Db): AppServices {
  const purchaseOrders = new DrizzlePurchaseOrderRepository(db);
  const goodsReceipts = new DrizzleGoodsReceiptRepository(db);
  const stock = new DrizzleStockRepository(db);
  const lots = new DrizzleLotRepository(db);
  const serials = new DrizzleSerialRepository(db);
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
  };
}
