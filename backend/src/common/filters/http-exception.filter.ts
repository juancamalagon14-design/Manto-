import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails } from '../dto/problem-details.dto';

/** Títulos en español para los status que la API produce de verdad. */
const TITULOS_POR_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Solicitud Inválida',
  [HttpStatus.UNAUTHORIZED]: 'No Autenticado',
  [HttpStatus.FORBIDDEN]: 'No Autorizado',
  [HttpStatus.NOT_FOUND]: 'Recurso No Encontrado',
  [HttpStatus.CONFLICT]: 'Conflicto con el Estado Actual',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Entidad No Procesable',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiadas Solicitudes',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Error Interno del Servidor',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Servicio No Disponible',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Error Interno del Servidor';
    let detail = 'Ocurrió un error inesperado al procesar la solicitud.';
    let code = 'INTERNAL_ERROR';
    let invalidParams: Array<{ name: string; reason: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // El título y el código salen del status, no de los valores por defecto
      // del 500. Sin esto, un 429 del limitador de tasa se respondía con
      // `title: "Error Interno del Servidor"` y `code: "INTERNAL_ERROR"`: un
      // documento RFC 7807 que se contradice con su propio status.
      title = TITULOS_POR_STATUS[status] ?? HttpStatus[status] ?? exception.name;
      code = `HTTP_${status}`;

      if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, any>;
        detail = Array.isArray(respObj.message) ? respObj.message.join('; ') : respObj.message || detail;
        code = respObj.code || `HTTP_${status}`;

        if (Array.isArray(respObj.message)) {
          invalidParams = respObj.message.map((msg: string) => ({
            name: 'body',
            reason: msg,
          }));
        }
      }
    } else if (exception instanceof Error) {
      // El mensaje interno se registra, no se responde. Antes iba al cliente
      // en `detail`, y por ahí salían al exterior cosas como el `statusText`
      // crudo de la pasarela de pagos o el error de sintaxis de una llave
      // Bre-B. Para correlacionar está `traceId`.
      this.logger.error(`Excepción no controlada: ${exception.message}`, exception.stack);
    }

    const problem: ProblemDetails = {
      type: `https://api.manto.com.co/errors/${code.toLowerCase()}`,
      title,
      status,
      detail,
      instance: request.url,
      code,
      invalidParams,
      timestamp: new Date().toISOString(),
      traceId: (request.headers['x-trace-id'] as string) || undefined,
    };

    response.status(status).setHeader('Content-Type', 'application/problem+json').json(problem);
  }
}
