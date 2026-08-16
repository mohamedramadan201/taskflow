ALTER TABLE "Task"
  ADD COLUMN "updatedProductsCount" INTEGER,
  ADD COLUMN "newProductsCount" INTEGER,
  ADD COLUMN "updatedImagesCount" INTEGER,
  ADD COLUMN "newImagesCount" INTEGER;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_updatedProductsCount_nonnegative" CHECK ("updatedProductsCount" IS NULL OR "updatedProductsCount" >= 0),
  ADD CONSTRAINT "Task_newProductsCount_nonnegative" CHECK ("newProductsCount" IS NULL OR "newProductsCount" >= 0),
  ADD CONSTRAINT "Task_updatedImagesCount_nonnegative" CHECK ("updatedImagesCount" IS NULL OR "updatedImagesCount" >= 0),
  ADD CONSTRAINT "Task_newImagesCount_nonnegative" CHECK ("newImagesCount" IS NULL OR "newImagesCount" >= 0);
