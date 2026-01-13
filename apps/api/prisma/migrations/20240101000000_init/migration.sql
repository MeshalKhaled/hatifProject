-- CreateTable
CREATE TABLE "Blob" (
    "id" TEXT NOT NULL,
    "backend" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlobDataStore" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobDataStore_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Blob_storage_key_idx" ON "Blob"("storage_key");
