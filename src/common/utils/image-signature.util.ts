import { BadRequestException } from '@nestjs/common';

// multer's fileFilter só vê o mimetype declarado pelo cliente (fácil de
// mentir), não o conteúdo real — por isso a validação a sério só pode
// acontecer aqui, depois de o ficheiro já estar em memória, verificando os
// magic bytes das assinaturas de imagem suportadas (JPEG/PNG/WebP).
export function assertIsImageBuffer(buffer: Buffer): void {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throw new BadRequestException({
      error: 'ficheiro_invalido',
      message: 'O ficheiro enviado não é uma imagem válida (JPEG, PNG ou WebP).',
    });
  }
}
