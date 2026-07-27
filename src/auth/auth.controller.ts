import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateIdiomaDto } from './dto/update-idioma.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('validate-token')
  // Sem isto, o limite genérico (100/min/IP) deixava adivinhar tokens de
  // stand a um ritmo incomodamente alto — este endpoint não precisa de
  // tanto tráfego legítimo (só corre 1x por dispositivo/token novo).
  @Throttle({ default: { limit: 20, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  validateToken(@Body() dto: ValidateTokenDto) {
    return this.authService.validateToken(dto.token);
  }

  @Public()
  @Post('login')
  // Mesma razão: o limite genérico permitia ~100 tentativas de password/min
  // contra o mesmo email a partir de 1 IP — força bruta online demasiado fácil.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password, dto.standId);
    return {
      jwt: result.jwt,
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return {
      jwt: result.jwt,
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      user: result.user,
    };
  }

  @Patch('idioma')
  updateIdioma(@CurrentUser() user: JwtPayload, @Body() dto: UpdateIdiomaDto) {
    return this.authService.updateIdioma(user.sub, dto.idioma);
  }

  // Só o owner (secção 4) — é um assunto financeiro/administrativo do
  // stand, o vendedor não precisa de saber (mesmo padrão de Equipa/Financeiro).
  @Get('subscription-status')
  @UseGuards(RolesGuard)
  @Roles('owner')
  subscriptionStatus(@CurrentUser() user: JwtPayload) {
    return this.authService.subscriptionStatus(user.standId);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }
}
