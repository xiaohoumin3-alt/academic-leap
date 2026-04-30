-- CreateTable
CREATE TABLE "UOKState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "knowledge" TEXT NOT NULL DEFAULT '{}',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "embedding" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UOKQuestionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "topic" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "embedding" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TemplateGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgePointId" TEXT NOT NULL,
    "generatorModel" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "rawOutput" TEXT NOT NULL,
    "generatedCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TemplateValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "validatorModel" TEXT NOT NULL,
    "validationType" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateValidation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "modifications" JSONB,
    "duration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateReview_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeCoverage" (
    "knowledgePointId" TEXT NOT NULL PRIMARY KEY,
    "targetTemplateCount" INTEGER NOT NULL DEFAULT 3,
    "currentTemplateCount" INTEGER NOT NULL DEFAULT 0,
    "gap" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeCoverage_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "KnowledgePoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'calculation',
    "content" TEXT NOT NULL DEFAULT '{}',
    "answer" TEXT NOT NULL,
    "hint" TEXT,
    "complexitySpec" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "promotionScore" REAL,
    "promotedAt" DATETIME,
    "auditReason" TEXT
);

-- CreateTable
CREATE TABLE "RLModelVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "bucketSize" REAL NOT NULL DEFAULT 0.5,
    "priorAlpha" REAL NOT NULL DEFAULT 1,
    "priorBeta" REAL NOT NULL DEFAULT 1,
    "trainedAt" DATETIME,
    "avgReward" REAL,
    "totalSelections" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'TRAINING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RLBanditArm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "deltaC" REAL NOT NULL,
    "alpha" INTEGER NOT NULL DEFAULT 1,
    "beta" INTEGER NOT NULL DEFAULT 1,
    "pullCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "avgReward" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RLBanditArm_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "RLModelVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RLTrainingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "knowledgePointId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "preAccuracy" REAL NOT NULL,
    "stateTheta" REAL NOT NULL,
    "selectedDeltaC" REAL NOT NULL,
    "reward" REAL NOT NULL,
    "postAccuracy" REAL,
    "leDelta" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RLTrainingLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "RLModelVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IRTStudentState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "theta" REAL NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 1,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "lastEstimatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LEKnowledgePointState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "knowledgePointId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0.5,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShadowAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgePoint" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "duration" INTEGER NOT NULL,
    "leDelta" REAL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EffectExperiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "controlTemplateId" TEXT NOT NULL,
    "treatmentTemplateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetMetric" TEXT NOT NULL,
    "minSampleSize" INTEGER NOT NULL DEFAULT 50,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EffectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EffectAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "EffectExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EffectObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EffectObservation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "EffectExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanaryRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 0,
    "trafficPercent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" DATETIME,
    "lastHealthCheck" DATETIME,
    "healthStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CanaryStageHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canaryId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "trafficPercent" INTEGER NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" DATETIME,
    "leValue" REAL,
    "accuracyValue" REAL,
    CONSTRAINT "CanaryStageHistory_canaryId_fkey" FOREIGN KEY ("canaryId") REFERENCES "CanaryRelease" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '{}',
    "answer" TEXT NOT NULL,
    "hint" TEXT,
    "knowledgePoints" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "params" TEXT DEFAULT '{}',
    "stepTypes" TEXT DEFAULT '[]',
    "templateId" TEXT,
    "generatedFrom" TEXT,
    "complexitySpec" TEXT DEFAULT '{}',
    "cognitiveLoad" REAL,
    "reasoningDepth" REAL,
    "complexity" REAL,
    "extractionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "featuresExtractedAt" DATETIME,
    "extractionError" TEXT,
    "extractionModel" TEXT DEFAULT 'gemma-4-31b-it-v1'
);
INSERT INTO "new_Question" ("answer", "content", "createdAt", "createdBy", "difficulty", "hint", "id", "isAI", "knowledgePoints", "params", "stepTypes", "templateId", "type") SELECT "answer", "content", "createdAt", "createdBy", "difficulty", "hint", "id", "isAI", "knowledgePoints", "params", "stepTypes", "templateId", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_extractionStatus_idx" ON "Question"("extractionStatus");
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "templateKey" TEXT,
    "structure" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "knowledgeId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "skeletonIds" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "generatedBy" TEXT NOT NULL DEFAULT 'manual',
    "generatorModel" TEXT,
    "generationPrompt" TEXT,
    "generationId" TEXT,
    "validatedBy" TEXT,
    "validationResult" JSONB,
    "qualityScore" INTEGER,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorRate" REAL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    CONSTRAINT "Template_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeConcept" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Template_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Template_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "TemplateGeneration" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("createdAt", "createdBy", "id", "knowledgeId", "name", "params", "publishedAt", "skeletonIds", "source", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version") SELECT "createdAt", "createdBy", "id", "knowledgeId", "name", "params", "publishedAt", "skeletonIds", "source", "status", "steps", "structure", "templateKey", "type", "updatedAt", "version" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UOKState_studentId_idx" ON "UOKState"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "UOKState_studentId_key" ON "UOKState"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "UOKQuestionState_questionId_key" ON "UOKQuestionState"("questionId");

-- CreateIndex
CREATE INDEX "TemplateGeneration_knowledgePointId_idx" ON "TemplateGeneration"("knowledgePointId");

-- CreateIndex
CREATE INDEX "GeneratedQuestion_batchId_idx" ON "GeneratedQuestion"("batchId");

-- CreateIndex
CREATE INDEX "GeneratedQuestion_promotionStatus_idx" ON "GeneratedQuestion"("promotionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RLModelVersion_version_key" ON "RLModelVersion"("version");

-- CreateIndex
CREATE INDEX "RLModelVersion_status_idx" ON "RLModelVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RLBanditArm_modelId_deltaC_key" ON "RLBanditArm"("modelId", "deltaC");

-- CreateIndex
CREATE UNIQUE INDEX "RLTrainingLog_eventId_key" ON "RLTrainingLog"("eventId");

-- CreateIndex
CREATE INDEX "RLTrainingLog_eventId_idx" ON "RLTrainingLog"("eventId");

-- CreateIndex
CREATE INDEX "RLTrainingLog_attemptId_idx" ON "RLTrainingLog"("attemptId");

-- CreateIndex
CREATE INDEX "RLTrainingLog_modelId_userId_idx" ON "RLTrainingLog"("modelId", "userId");

-- CreateIndex
CREATE INDEX "RLTrainingLog_knowledgePointId_idx" ON "RLTrainingLog"("knowledgePointId");

-- CreateIndex
CREATE INDEX "RLTrainingLog_recommendationId_idx" ON "RLTrainingLog"("recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "IRTStudentState_userId_key" ON "IRTStudentState"("userId");

-- CreateIndex
CREATE INDEX "IRTStudentState_lastEstimatedAt_idx" ON "IRTStudentState"("lastEstimatedAt");

-- CreateIndex
CREATE INDEX "IRTStudentState_responseCount_idx" ON "IRTStudentState"("responseCount");

-- CreateIndex
CREATE INDEX "IRTStudentState_theta_idx" ON "IRTStudentState"("theta");

-- CreateIndex
CREATE INDEX "LEKnowledgePointState_userId_idx" ON "LEKnowledgePointState"("userId");

-- CreateIndex
CREATE INDEX "LEKnowledgePointState_knowledgePointId_idx" ON "LEKnowledgePointState"("knowledgePointId");

-- CreateIndex
CREATE UNIQUE INDEX "LEKnowledgePointState_userId_knowledgePointId_key" ON "LEKnowledgePointState"("userId", "knowledgePointId");

-- CreateIndex
CREATE INDEX "ShadowAttempt_templateId_idx" ON "ShadowAttempt"("templateId");

-- CreateIndex
CREATE INDEX "ShadowAttempt_knowledgePoint_idx" ON "ShadowAttempt"("knowledgePoint");

-- CreateIndex
CREATE INDEX "ShadowAttempt_userId_idx" ON "ShadowAttempt"("userId");

-- CreateIndex
CREATE INDEX "EffectExperiment_status_idx" ON "EffectExperiment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EffectAssignment_experimentId_userId_key" ON "EffectAssignment"("experimentId", "userId");

-- CreateIndex
CREATE INDEX "EffectObservation_experimentId_variant_idx" ON "EffectObservation"("experimentId", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryRelease_templateId_key" ON "CanaryRelease"("templateId");

-- CreateIndex
CREATE INDEX "CanaryRelease_templateId_idx" ON "CanaryRelease"("templateId");

-- CreateIndex
CREATE INDEX "CanaryRelease_status_idx" ON "CanaryRelease"("status");
