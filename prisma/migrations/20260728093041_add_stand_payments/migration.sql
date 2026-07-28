-- CreateTable
CREATE TABLE "stand_payments" (
    "id" UUID NOT NULL,
    "stand_id" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" DATE NOT NULL,
    "notas" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stand_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stand_payments" ADD CONSTRAINT "stand_payments_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
