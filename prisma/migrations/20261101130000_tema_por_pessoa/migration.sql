-- O tema passa a ser escolhido por cada pessoa (não pelo stand).
ALTER TABLE "stands" DROP COLUMN "tema";
ALTER TABLE "people" ADD COLUMN     "tema" TEXT NOT NULL DEFAULT 'editorial';
