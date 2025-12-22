import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { headers: any }>();
    const span = trace.getActiveSpan();

    if (span) {
      span.setAttribute('http.route', req.url ?? '');
      span.setAttribute('app.client', req.headers?.['user-agent'] ?? '');
      // If you later add tenant header, capture here:
      // span.setAttribute('app.tenant', req.headers?.['x-tenant-id'] ?? 'unknown');
    }

    return next.handle().pipe(
      tap({
        error: (e) => {
          if (span) {
            span.recordException(e as any);
          }
        },
      }),
    );
  }
}

