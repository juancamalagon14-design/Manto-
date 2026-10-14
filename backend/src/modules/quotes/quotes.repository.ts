import { Injectable } from '@nestjs/common';
import { IQuotesRepository, QuoteSnapshot } from './quotes.types';

@Injectable()
export class InMemoryQuotesRepository implements IQuotesRepository {
  private readonly quotes = new Map<string, QuoteSnapshot>();

  private clone(quote: QuoteSnapshot): QuoteSnapshot {
    if (typeof structuredClone === 'function') {
      return structuredClone(quote);
    }
    return JSON.parse(JSON.stringify(quote));
  }

  public async save(quote: QuoteSnapshot): Promise<QuoteSnapshot> {
    const copy = this.clone(quote);
    this.quotes.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findById(id: string): Promise<QuoteSnapshot | null> {
    const quote = this.quotes.get(id);
    if (!quote) {
      return null;
    }
    return this.clone(quote);
  }

  public async findByQuoteNumber(quoteNumber: string): Promise<QuoteSnapshot | null> {
    for (const quote of this.quotes.values()) {
      if (quote.quoteNumber === quoteNumber) {
        return this.clone(quote);
      }
    }
    return null;
  }

  public async update(quote: QuoteSnapshot): Promise<QuoteSnapshot> {
    const copy = this.clone(quote);
    this.quotes.set(copy.id, copy);
    return this.clone(copy);
  }

  /**
   * Utilidad para limpiar el almacenamiento durante pruebas unitarias.
   */
  public clear(): void {
    this.quotes.clear();
  }
}
