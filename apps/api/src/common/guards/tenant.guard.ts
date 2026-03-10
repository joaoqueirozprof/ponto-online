import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * TenantGuard ensures that company-scoped users can only access
 * data belonging to their own company.
 *
 * Super admins (companyId === null) bypass this check but their
 * access is logged as support access for LGPD compliance.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Super admin has access but we flag it
    if (user.isSuperAdmin) {
      request.isSupportAccess = true;
      return true;
    }

    // Regular users must have a companyId
    if (!user.companyId) {
      throw new ForbiddenException('Usuário não vinculado a nenhuma empresa');
    }

    // Set tenant context on request for use in services
    request.tenantCompanyId = user.companyId;
    request.tenantBranchId = user.branchId;

    return true;
  }
}
