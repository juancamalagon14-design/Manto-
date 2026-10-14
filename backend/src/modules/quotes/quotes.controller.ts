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
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { BindQuoteDto } from './dto/bind-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesService } from './quotes.service';
import { QuoteSnapshot } from './quotes.types';

@Controller(['v1/quotes', 'quotes'])
@UseFilters(HttpExceptionFilter)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  /**
   * POST /v1/quotes
   * 
   * Evalúa elegibilidad, calcula tarificación y genera un snapshot de cotización inmutable.
   * Retorna 201 Created con el QuoteSnapshot generado.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createQuote(@Body() dto: CreateQuoteDto): Promise<QuoteSnapshot> {
    return await this.quotesService.createQuote(dto);
  }

  /**
   * GET /v1/quotes/:id
   * 
   * Recupera una cotización por su UUID.
   * Aplica verificación dinámica de vigencia de 15 días calendario (marca EXPIRED si corresponde).
   * Retorna 200 OK.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getQuote(@Param('id') id: string): Promise<QuoteSnapshot> {
    return await this.quotesService.getQuoteById(id);
  }

  /**
   * POST /v1/quotes/:id/bind
   * 
   * Vincula una cotización vigente a póliza (estado BOUND).
   * Valida vigencia de 15 días, no duplicidad y elegibilidad previa.
   * Retorna 200 OK.
   */
  @Post(':id/bind')
  @HttpCode(HttpStatus.OK)
  public async bindQuote(
    @Param('id') id: string,
    @Body() dto: BindQuoteDto,
  ): Promise<QuoteSnapshot> {
    return await this.quotesService.bindQuote(id, dto);
  }
}
