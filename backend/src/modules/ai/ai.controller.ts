import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { AiChatService } from './ai-chat.service';
import { ChatMessage, ChatSessionState } from './ai.types';
import { SendLivePhotoDto, StartChatDto } from './dto/chat.dto';

@Controller(['v1/ai/chat', 'ai/chat'])
@UseFilters(HttpExceptionFilter)
export class AiController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * GET /v1/ai/chat/age-options
   * 
   * Retorna el catálogo completo de opciones de edad (meses para cachorros, años para adultos,
   * y flags de advertencia para < 2 meses y > 8 años) para el selector desplegable.
   */
  @Get('age-options')
  @HttpCode(HttpStatus.OK)
  public getAgeDropdownOptions() {
    return this.aiChatService.getAgeDropdownOptions();
  }

  /**
   * POST /v1/ai/chat/start
   * 
   * Abre la sesión de Nuquí. Devuelve el saludo y la bifurcación inicial
   * (foto en vivo o conversación). No cotiza: eso lo hace el motor actuarial.
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  public startChat(
    @Body() dto: StartChatDto,
  ): { session: ChatSessionState; welcomeMessage: ChatMessage } {
    return this.aiChatService.startChat(dto);
  }

  /**
   * POST /v1/ai/chat/:sessionId/live-photo
   * 
   * Restricción estricta de cámara: procesa una captura tomada en vivo
   * (isLiveCapture = true) e invoca Gemini 2.0 Flash Vision.
   *
   * Cuando la confianza del análisis es baja, la respuesta marca
   * `requiresBreedConfirmation` para que Nuquí pregunte la raza en vez de
   * darla por buena: de la raza depende la RC obligatoria de la Ley 1801.
   */
  @Post(':sessionId/live-photo')
  @Throttle({ vision: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  public async processLivePhoto(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendLivePhotoDto,
  ): Promise<{ session: ChatSessionState; reply: ChatMessage }> {
    return await this.aiChatService.processLivePhoto(sessionId, dto);
  }

  /**
   * GET /v1/ai/chat/:sessionId
   * 
   * Consulta el estado de la sesión y los slots acumulados. Solo lectura.
   */
  @Get(':sessionId')
  @HttpCode(HttpStatus.OK)
  public getSession(@Param('sessionId') sessionId: string): ChatSessionState {
    return this.aiChatService.getSession(sessionId);
  }
}
