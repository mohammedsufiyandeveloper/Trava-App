-- Travis AI: assistant persistence & idempotency.
-- Authored but NOT applied to production. See docs/TRAVIS.md for deploy steps.

-- CreateTable
CREATE TABLE "travisIdempotency" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "ok" BOOLEAN,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travisIdempotency_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "travisConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travisConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travisMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "toolOutcome" TEXT,
    "entityRefs" JSONB,
    "confirmationState" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travisMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "travisIdempotency_workspaceId_idx" ON "travisIdempotency"("workspaceId");
CREATE INDEX "travisIdempotency_createdAt_idx" ON "travisIdempotency"("createdAt");
CREATE INDEX "travisConversation_workspaceId_userId_updatedAt_idx" ON "travisConversation"("workspaceId", "userId", "updatedAt" DESC);
CREATE INDEX "travisMessage_conversationId_createdAt_idx" ON "travisMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "travisMessage" ADD CONSTRAINT "travisMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "travisConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
