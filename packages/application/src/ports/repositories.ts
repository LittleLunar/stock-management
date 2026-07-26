import type {
  Branch,
  Category,
  Customer,
  Location,
  Membership,
  Organization,
  Product,
  ProductBarcode,
  Supplier,
  User,
} from "@stock-management/domain";
import type {
  CreateBranchInput,
  CreateCategoryInput,
  CreateCustomerInput,
  CreateLocationInput,
  CreateMembershipInput,
  CreateOrganizationInput,
  CreateProductInput,
  CreateSupplierInput,
  CreateUserInput,
  UpdateBranchInput,
  UpdateCategoryInput,
  UpdateLocationInput,
  UpdateOrganizationInput,
  UpdateProductInput,
  UpdateSupplierInput,
} from "../dto/inputs.js";

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization | null>;
  create(input: CreateOrganizationInput): Promise<Organization>;
}

export interface BranchRepository {
  list(orgId: string): Promise<Branch[]>;
  findById(orgId: string, id: string): Promise<Branch | null>;
  create(orgId: string, input: CreateBranchInput): Promise<Branch>;
  update(orgId: string, id: string, input: UpdateBranchInput): Promise<Branch | null>;
}

export interface LocationRepository {
  list(orgId: string, branchId?: string): Promise<Location[]>;
  findById(orgId: string, id: string): Promise<Location | null>;
  create(orgId: string, input: CreateLocationInput): Promise<Location>;
  update(
    orgId: string,
    id: string,
    input: UpdateLocationInput,
  ): Promise<Location | null>;
}

export interface CategoryRepository {
  list(orgId: string): Promise<Category[]>;
  findById(orgId: string, id: string): Promise<Category | null>;
  create(orgId: string, input: CreateCategoryInput): Promise<Category>;
  update(
    orgId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category | null>;
}

export interface ProductRepository {
  list(orgId: string): Promise<Product[]>;
  findById(orgId: string, id: string): Promise<Product | null>;
  listBarcodes(orgId: string, productId: string): Promise<ProductBarcode[]>;
  create(orgId: string, input: CreateProductInput): Promise<Product>;
  update(orgId: string, id: string, input: UpdateProductInput): Promise<Product | null>;
}

export interface SupplierRepository {
  list(orgId: string): Promise<Supplier[]>;
  findById(orgId: string, id: string): Promise<Supplier | null>;
  create(orgId: string, input: CreateSupplierInput): Promise<Supplier>;
  update(
    orgId: string,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier | null>;
}

export interface CustomerRepository {
  list(orgId: string): Promise<Customer[]>;
  findById(orgId: string, id: string): Promise<Customer | null>;
  create(orgId: string, input: CreateCustomerInput): Promise<Customer>;
}

export interface UsersRepository {
  listUsers(orgId: string): Promise<User[]>;
  createUser(orgId: string, input: CreateUserInput): Promise<User>;
  listMemberships(orgId: string): Promise<Membership[]>;
  createMembership(orgId: string, input: CreateMembershipInput): Promise<Membership>;
  findMembership(orgId: string, id: string): Promise<Membership | null>;
}
