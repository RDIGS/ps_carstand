-- CreateEnum
CREATE TYPE "TipoEntidade" AS ENUM ('singular', 'coletiva');

-- CreateEnum
CREATE TYPE "TipoDocumentoLegal" AS ENUM ('termos', 'privacidade', 'dpa');

-- CreateTable
CREATE TABLE "platform_entity_config" (
    "id" UUID NOT NULL,
    "tipo_entidade" "TipoEntidade" NOT NULL,
    "nome" TEXT NOT NULL,
    "identificador_fiscal" TEXT NOT NULL,
    "morada" TEXT NOT NULL,
    "cae" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_entity_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "tipo" "TipoDocumentoLegal" NOT NULL,
    "versao" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "legal_document_id" UUID NOT NULL,
    "aceite_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_tipo_versao_key" ON "legal_documents"("tipo", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptances_person_id_legal_document_id_key" ON "legal_acceptances"("person_id", "legal_document_id");

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
