import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AgeSelectionOption, ChatMode } from '../ai.types';

export const VALID_CHAT_MODES: ChatMode[] = ['INITIAL_SELECTION', 'LIVE_CAMERA'];

export class StartChatDto {
  @IsOptional()
  @IsIn(VALID_CHAT_MODES, {
    message: 'mode debe ser INITIAL_SELECTION o LIVE_CAMERA',
  })
  mode?: ChatMode = 'INITIAL_SELECTION';

  @IsOptional()
  @IsString({ message: 'customerName debe ser texto' })
  customerName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'customerEmail debe ser un correo válido' })
  customerEmail?: string;

  @IsOptional()
  @IsString({ message: 'customerPhone debe ser texto' })
  customerPhone?: string;
}

export class SendLivePhotoDto {
  @IsNotEmpty({ message: 'imageBase64 es obligatorio' })
  @IsString({ message: 'imageBase64 debe ser una cadena base64' })
  imageBase64: string;

  /**
   * Restricción Estricta de Cámara (Doctrina Lemonade / Manto 2.0):
   * Debe ser true para certificar que la foto proviene del sensor de cámara en vivo
   * (WebRTC / Camera API) y no de un archivo preexistente de disco o galería.
   */
  @IsNotEmpty({ message: 'isLiveCapture es obligatorio y debe ser true' })
  @IsBoolean({ message: 'isLiveCapture debe ser un valor booleano' })
  isLiveCapture: boolean;

  @IsOptional()
  @IsString({ message: 'mimeType debe ser texto (ej. image/jpeg, image/png)' })
  mimeType?: string = 'image/jpeg';

  @IsOptional()
  @IsString({ message: 'timestampCaptured debe ser una marca de tiempo ISO' })
  timestampCaptured?: string;
}

