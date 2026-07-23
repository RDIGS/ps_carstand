-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('windows', 'android', 'ios_pwa', 'macos_pwa');

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "versao_minima_obrigatoria" TEXT NOT NULL,
    "versao_recomendada" TEXT,
    "changelog_url" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_plataforma_key" ON "app_versions"("plataforma");
