import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { GeminiProvider } from './gemini.provider';

/**
 * Módulo de IA: sesión conversacional de Nuquí y visión por computador.
 *
 * Ya no importa QuotesModule ni PricingModule. Los importaba cuando este
 * módulo tenía su propio cotizador; hoy Nuquí llama al motor directamente y
 * esa dependencia era justo el camino por el que reaparecía un segundo flujo
 * de tarifación.
 */
@Module({
  controllers: [AiController],
  providers: [AiChatService, GeminiProvider],
  exports: [AiChatService, GeminiProvider],
})
export class AiModule {}
