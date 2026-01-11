-- CreateTable
CREATE TABLE "PincodeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "deliverable" BOOLEAN NOT NULL DEFAULT true,
    "etaMinDays" INTEGER,
    "etaMaxDays" INTEGER,
    "codAvailable" BOOLEAN NOT NULL DEFAULT false,
    "shippingFee" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PincodeRule_shop_idx" ON "PincodeRule"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "PincodeRule_shop_pincode_key" ON "PincodeRule"("shop", "pincode");
