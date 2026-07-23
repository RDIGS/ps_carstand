import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { CreateChecklistTemplateDto } from './dto/create-template.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Secção 25: "o owner cria modelos de checklist reutilizáveis" — criação é
// só do owner, tal como o resto da configuração do stand (equipa, financeiro).
@Controller('checklist-templates')
@UseGuards(RolesGuard)
export class ChecklistTemplatesController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.checklistService.listTemplates(user);
  }

  @Post()
  @Roles('owner')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateChecklistTemplateDto) {
    return this.checklistService.createTemplate(user, dto.nome, dto.itens);
  }
}
