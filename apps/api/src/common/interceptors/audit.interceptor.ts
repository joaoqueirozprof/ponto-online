import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body, params } = request;

    return next.handle().pipe(
      tap(async (response) => {
        if (user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          try {
            const [baseUrl] = url.split('?');
            const entity = this.extractEntity(baseUrl);
            const entityId = params.id || params.employeeId || body?.id || '';

            if (entity) {
              await this.auditService.createAuditLog({
                userId: user.sub,
                action: method,
                entity,
                entityId,
                newValues: body,
                ipAddress: request.ip,
                companyId: user.companyId || 'unknown',
                branchId: user.branchId,
              });
            }
          } catch (error) {
            console.error('Error creating audit log:', error);
          }
        }
      }),
    );
  }

  private extractEntity(url: string): string {
    const segments = url.split('/').filter((s) => s);
    const apiIndex = segments.indexOf('api');
    if (apiIndex !== -1 && segments[apiIndex + 2]) {
      return segments[apiIndex + 2].split('-').join('_');
    }
    return '';
  }
}
