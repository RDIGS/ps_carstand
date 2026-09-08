import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { StandsService } from './stands.service';
import { UpdateStandProfileDto } from './dto/update-stand-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { assertIsImageBuffer } from '../common/utils/image-signature.util';

// Perfil público da loja (contacto/redes sociais, usado no gerador de banner
// de venda) — self-service pelo próprio owner, distinto do StandsController
// (esse é o painel de super-admin, autenticado por chave, não por JWT).
@Controller('stands/me')
@UseGuards(RolesGuard)
export class StandProfileController {
  constructor(private readonly standsService: StandsService) {}

  // Leitura: owner e vendedor (o vendedor também gera banners e precisa do
  // contacto/@handle já guardados, só não pode editá-los).
  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.standsService.getProfile(user.standId);
  }

  @Patch()
  @Roles('owner')
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateStandProfileDto) {
    return this.standsService.updateProfile(user.standId, dto);
  }

  // Logótipo para o gerador de banner de venda — igual limite/proteção do
  // upload de fotos de veículo (secção equivalente em VehiclesController).
  @Post('logo')
  @Roles('owner')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@CurrentUser() user: JwtPayload, @UploadedFile() logo?: Express.Multer.File) {
    if (!logo) {
      return { error: 'campos_em_falta', message: 'É necessário enviar uma imagem.' };
    }
    assertIsImageBuffer(logo.buffer);
    return this.standsService.uploadLogo(user.standId, logo.buffer);
  }

  @Delete('logo')
  @Roles('owner')
  removeLogo(@CurrentUser() user: JwtPayload) {
    return this.standsService.removeLogo(user.standId);
  }
}
