CREATE TABLE "TelegramConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "defaultWorkspaceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramUpdate" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramConnection_userId_key" ON "TelegramConnection"("userId");
CREATE UNIQUE INDEX "TelegramConnection_telegramUserId_key" ON "TelegramConnection"("telegramUserId");
CREATE INDEX "TelegramConnection_chatId_idx" ON "TelegramConnection"("chatId");
CREATE INDEX "TelegramConnection_enabled_lastSeenAt_idx" ON "TelegramConnection"("enabled", "lastSeenAt");
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");
CREATE INDEX "TelegramLinkToken_userId_expiresAt_idx" ON "TelegramLinkToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "TelegramUpdate_updateId_key" ON "TelegramUpdate"("updateId");
CREATE INDEX "TelegramUpdate_createdAt_idx" ON "TelegramUpdate"("createdAt");

ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
