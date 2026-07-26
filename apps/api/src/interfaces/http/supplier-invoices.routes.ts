import type { FastifyPluginAsync } from "fastify";
import type {
  ApAgingReportUseCase,
  PostSupplierInvoice,
  SupplierInvoiceUseCases,
  VoidSupplierInvoice,
} from "@stock-management/application";
import {
  ApAgingQuerySchema,
  CreateSupplierInvoiceSchema,
  PostIdempotencyHeadersSchema,
  PostIdempotencySchema,
  SupplierInvoiceIdParamsSchema,
  UpdateSupplierInvoiceSchema,
} from "@stock-management/shared";
import {
  assertCanPerform,
  assertOptionalDocumentBranchWrite,
  listFilterFromContext,
} from "./branch-scope.js";

export type SupplierInvoiceRouteUseCases = {
  supplierInvoices: SupplierInvoiceUseCases;
  postSupplierInvoice: PostSupplierInvoice;
  voidSupplierInvoice: VoidSupplierInvoice;
};

export function supplierInvoicesRoutes(
  useCases: SupplierInvoiceRouteUseCases,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/supplier-invoices", async (request) =>
      useCases.supplierInvoices.list(
        request.ctx.orgId,
        listFilterFromContext(request.ctx),
      ),
    );

    app.get<{ Params: { id: string } }>(
      "/supplier-invoices/:id",
      async (request) => {
        const { id } = SupplierInvoiceIdParamsSchema.parse(request.params);
        return useCases.supplierInvoices.get(request.ctx.orgId, id);
      },
    );

    app.post("/supplier-invoices", async (request) => {
      const body = CreateSupplierInvoiceSchema.parse(request.body);
      assertOptionalDocumentBranchWrite(
        request.ctx,
        "po.write",
        body.branchId,
        "Role cannot write purchase orders",
      );
      return useCases.supplierInvoices.create(request.ctx.orgId, body);
    });

    app.patch<{ Params: { id: string } }>(
      "/supplier-invoices/:id",
      async (request) => {
        const { id } = SupplierInvoiceIdParamsSchema.parse(request.params);
        const body = UpdateSupplierInvoiceSchema.parse(request.body);
        const existing = await useCases.supplierInvoices.get(
          request.ctx.orgId,
          id,
        );
        assertOptionalDocumentBranchWrite(
          request.ctx,
          "po.write",
          body.branchId !== undefined ? body.branchId : existing.branchId,
          "Role cannot write purchase orders",
        );
        return useCases.supplierInvoices.update(request.ctx.orgId, id, body);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/supplier-invoices/:id/post",
      async (request) => {
        const { id } = SupplierInvoiceIdParamsSchema.parse(request.params);
        const doc = await useCases.supplierInvoices.get(request.ctx.orgId, id);
        assertOptionalDocumentBranchWrite(
          request.ctx,
          "po.write",
          doc.branchId,
          "Role cannot write purchase orders",
        );
        const body = PostIdempotencySchema.parse(request.body ?? {});
        const headers = PostIdempotencyHeadersSchema.parse(request.headers);
        const externalSystem = body.external_system ?? headers.external_system;
        const externalId = body.external_id ?? headers.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.postSupplierInvoice.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );

    app.post<{ Params: { id: string } }>(
      "/supplier-invoices/:id/void",
      async (request) => {
        const { id } = SupplierInvoiceIdParamsSchema.parse(request.params);
        const doc = await useCases.supplierInvoices.get(request.ctx.orgId, id);
        assertOptionalDocumentBranchWrite(
          request.ctx,
          "po.write",
          doc.branchId,
          "Role cannot write purchase orders",
        );
        const body = PostIdempotencySchema.parse(request.body ?? {});
        const headers = PostIdempotencyHeadersSchema.parse(request.headers);
        const externalSystem = body.external_system ?? headers.external_system;
        const externalId = body.external_id ?? headers.external_id;
        const idempotency =
          externalSystem && externalId
            ? { externalSystem, externalId }
            : undefined;
        return useCases.voidSupplierInvoice.execute(
          request.ctx.orgId,
          request.ctx.userId,
          id,
          idempotency,
        );
      },
    );
  };
}

export function apReportsRoutes(
  apAging: ApAgingReportUseCase,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/reports/ap-aging", async (request) => {
      assertCanPerform(
        request.ctx,
        "accounting.read",
        "Role cannot read accounting reports",
      );
      const query = ApAgingQuerySchema.parse(request.query);
      return apAging.execute(request.ctx.orgId, query.asOf);
    });
  };
}
