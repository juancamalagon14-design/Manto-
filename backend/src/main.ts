// Support JSON serialization of BigInt values (ColombianPeso nominal types)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import { json, urlencoded } from 'express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * Soporte para fotos de cámara en vivo y comprobantes en Base64.
   * Por defecto Express limita a 100kb, lo que causaba HTTP 413 PayloadTooLargeError.
   */
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  /**
   * Detrás de un balanceador (Azure App Service, Front Door) `req.ip` es la IP
   * del proxy, no la del cliente: el limitador de tasa pasaría a contar un
   * único cupo para todo el sitio y un usuario cualquiera provocaría 429 en el
   * checkout de los demás. Con `trust proxy` Express toma la IP real de
   * `X-Forwarded-For`.
   *
   * Se limita a un salto: confiar en toda la cadena permitiría que el cliente
   * falsifique su propia IP añadiendo cabeceras.
   */
  app.set('trust proxy', 1);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  /**
   * Sin esta línea `onApplicationShutdown` no corre nunca, y el
   * `DatabaseModule` jamás cierra el pool: verificado con un `SIGTERM`, el
   * proceso terminaba con las consultas en vuelo cortadas en seco. En un
   * despliegue rodante de Azure App Service eso interrumpe escrituras a mitad
   * —una póliza que se estaba activando, un reembolso que se estaba
   * registrando—. Con los hooks, Nest drena antes de salir.
   */
  app.enableShutdownHooks();

  /**
   * 3003, y el frontend en 3002.
   *
   * Los puertos han cambiado dos veces; queda escrito para no repetirlo. Este
   * backend usaba 3000, el mismo que Next por defecto, y el que arrancaba
   * segundo no podía abrir; además el proxy del frontend apuntaba a
   * `localhost:3000`, así que cuando ganaba el frontend se reenviaba las
   * peticiones a sí mismo. Se movió a 3001 — pero el frontend estaba fijado a
   * 3001 en su `package.json`, de modo que volvieron a quedar encima y el
   * navegador devolvía ERR_CONNECTION_REFUSED en el 3000, que ya no tenía
   * nada. Ahora son dos puertos altos que nadie más usa.
   *
   * `PORT` sigue mandando cuando está definida, que es lo que usará Azure App
   * Service.
   */
  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`🚀 Manto 2.0 Backend ejecutándose en http://localhost:${port}`);
}

bootstrap();
