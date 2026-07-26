import {
  BranchUseCases,
  CategoryUseCases,
  LocationUseCases,
  OrganizationUseCases,
  ProductUseCases,
  SupplierUseCases,
  UsersUseCases,
} from "@stock-management/application";
import type { Db } from "../infrastructure/db/client.js";
import { DrizzleBranchRepository } from "../infrastructure/persistence/branch.repository.js";
import { DrizzleCategoryRepository } from "../infrastructure/persistence/category.repository.js";
import { DrizzleLocationRepository } from "../infrastructure/persistence/location.repository.js";
import { DrizzleOrganizationRepository } from "../infrastructure/persistence/organization.repository.js";
import { DrizzleProductRepository } from "../infrastructure/persistence/product.repository.js";
import { DrizzleSupplierRepository } from "../infrastructure/persistence/supplier.repository.js";
import { DrizzleUsersRepository } from "../infrastructure/persistence/users.repository.js";

export type AppServices = {
  org: OrganizationUseCases;
  branches: BranchUseCases;
  locations: LocationUseCases;
  categories: CategoryUseCases;
  products: ProductUseCases;
  suppliers: SupplierUseCases;
  users: UsersUseCases;
};

/** Composition root: wire infrastructure adapters to application use cases. */
export function createAppServices(db: Db): AppServices {
  return {
    org: new OrganizationUseCases(new DrizzleOrganizationRepository(db)),
    branches: new BranchUseCases(new DrizzleBranchRepository(db)),
    locations: new LocationUseCases(new DrizzleLocationRepository(db)),
    categories: new CategoryUseCases(new DrizzleCategoryRepository(db)),
    products: new ProductUseCases(new DrizzleProductRepository(db)),
    suppliers: new SupplierUseCases(new DrizzleSupplierRepository(db)),
    users: new UsersUseCases(new DrizzleUsersRepository(db)),
  };
}
