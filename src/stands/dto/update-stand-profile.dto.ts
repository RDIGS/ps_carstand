import { IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

// Primeiro segmento do endereço do site — não pode coincidir com caminhos da
// própria app web nem do backend (`/site/:slug` é servido pelo backend, mas o
// visitante vê `ps-carstand-app.onrender.com/:slug`, onde estes já existem).
export const SLUGS_RESERVADOS = [
  'api', 'site', 'admin', 'app', 'login', 'assets', 'icons', 'canvaskit', 'health',
  'storage', 'static', 'www', 'favicon.png', 'manifest.json', 'index.html',
];

export class UpdateStandProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  redesSociais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  morada?: string;

  // `null` = remover o endereço (e o site deixa de estar acessível).
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/, {
    message: 'O endereço só pode ter letras minúsculas, números e hífens (3 a 40 caracteres).',
  })
  slug?: string | null;

  @IsOptional()
  @IsBoolean()
  siteAtivo?: boolean;

  @IsOptional()
  @IsBoolean()
  vendedorPodeAprovarVisitas?: boolean;
}
