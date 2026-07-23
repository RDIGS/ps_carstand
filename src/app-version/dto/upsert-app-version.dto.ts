import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class UpsertAppVersionDto {
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'versaoMinimaObrigatoria deve seguir o formato X.Y.Z' })
  versaoMinimaObrigatoria!: string;

  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'versaoRecomendada deve seguir o formato X.Y.Z' })
  versaoRecomendada?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  changelogUrl?: string;
}
