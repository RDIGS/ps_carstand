-- CreateEnum
CREATE TYPE "TokenEstado" AS ENUM ('ativo', 'em_carencia', 'expirado', 'pendente', 'suspenso');

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('mensal', 'anual');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'vendedor');

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'pt',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stands" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "nif" TEXT,
    "morada" TEXT,
    "schema_name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "token_estado" "TokenEstado" NOT NULL DEFAULT 'pendente',
    "token_valido_ate" DATE,
    "dias_aviso_previo" INTEGER NOT NULL DEFAULT 5,
    "dias_carencia" INTEGER NOT NULL DEFAULT 5,
    "plano" "Plano",
    "preco_acordado" DECIMAL(10,2),
    "notas_pagamento" TEXT,
    "vendedor_pode_adicionar" BOOLEAN NOT NULL DEFAULT false,
    "vendedor_pode_editar_preco_kms" BOOLEAN NOT NULL DEFAULT false,
    "vendedor_precisa_aprovacao" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stand_members" (
    "id" UUID NOT NULL,
    "stand_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stand_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "stand_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device" TEXT,
    "usado_em" TIMESTAMP(3),
    "revogado" BOOLEAN NOT NULL DEFAULT false,
    "substituido_por" UUID,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_email_key" ON "people"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stands_schema_name_key" ON "stands"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "stands_token_key" ON "stands"("token");

-- CreateIndex
CREATE UNIQUE INDEX "stand_members_stand_id_person_id_key" ON "stand_members"("stand_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "stand_members" ADD CONSTRAINT "stand_members_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stand_members" ADD CONSTRAINT "stand_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
