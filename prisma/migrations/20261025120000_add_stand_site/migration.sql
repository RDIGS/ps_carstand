-- AlterTable
ALTER TABLE "stands" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "site_ativo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendedor_pode_aprovar_visitas" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "stands_slug_key" ON "stands"("slug");
