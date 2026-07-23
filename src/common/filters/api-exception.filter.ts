import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

// Regra transversal de erro (secção 13): { error, message, campo? } em todas as rotas.
interface ApiErrorBody {
  error: string;
  message: string;
  campo?: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      error: 'erro_interno',
      message: 'Ocorreu um erro inesperado. Tenta novamente.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        body = { error: this.codeFromStatus(status), message: res };
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        body = {
          error: (r.error as string) ?? this.codeFromStatus(status),
          message: this.flattenMessage(r.message) ?? exception.message,
          campo: r.campo as string | undefined,
        };
      }
    } else if (exception instanceof Error) {
      // Nunca mostrar o erro técnico cru ao utilizador (secção 20) — fica só nos logs.
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(body.message, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json(body);
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'nao_autenticado';
      case HttpStatus.FORBIDDEN:
        return 'sem_permissao';
      case HttpStatus.NOT_FOUND:
        return 'nao_encontrado';
      case HttpStatus.BAD_REQUEST:
        return 'pedido_invalido';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'demasiados_pedidos';
      default:
        return 'erro_interno';
    }
  }

  private flattenMessage(message: unknown): string | undefined {
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    return undefined;
  }
}
