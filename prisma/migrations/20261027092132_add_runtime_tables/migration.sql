-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_links" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zone" TEXT NOT NULL DEFAULT 'Unassigned',
    "citizenCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "dumpingSiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "crewId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "afterPhotoKey" TEXT,
    "closureLat" DOUBLE PRECISION,
    "closureLng" DOUBLE PRECISION,
    "closureDistance" INTEGER,
    "overrideFlag" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_approvals" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "afterPhotoKey" TEXT NOT NULL,
    "afterLat" DOUBLE PRECISION NOT NULL,
    "afterLng" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closure_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dumping_sites" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "hotspot" BOOLEAN NOT NULL DEFAULT false,
    "lastReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dumping_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dumping_remediations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dumping_remediations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "crewId" TEXT,
    "zone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastSpeed" DOUBLE PRECISION,
    "lastReportedAt" TIMESTAMP(3),
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staleAckedAt" TIMESTAMP(3),
    "offRouteSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_logs" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejected_positions" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejected_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "zone" TEXT,
    "shiftStart" TIMESTAMP(3) NOT NULL,
    "shiftEnd" TIMESTAMP(3) NOT NULL,
    "plannedPath" JSONB NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "thresholdMeters" INTEGER NOT NULL DEFAULT 50,
    "thresholdMinutes" INTEGER NOT NULL DEFAULT 10,
    "audited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviation_alerts" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL DEFAULT 0,
    "minutesOff" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "authorisedById" TEXT,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deviation_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_audits" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plannedMeters" INTEGER NOT NULL,
    "actualMeters" INTEGER NOT NULL,
    "varianceMeters" INTEGER NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER NOT NULL,
    "varianceMinutes" INTEGER NOT NULL,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "efficiency_index" (
    "id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "collectionRate" DOUBLE PRECISION,
    "avgResolutionHours" DOUBLE PRECISION,
    "routeAdherence" INTEGER,
    "ticketsOpened" INTEGER NOT NULL DEFAULT 0,
    "missedIncidents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "efficiency_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synced_actions" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "synced_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "in_app_notifications_citizenId_createdAt_idx" ON "in_app_notifications"("citizenId", "createdAt");

-- CreateIndex
CREATE INDEX "sms_logs_reportId_createdAt_idx" ON "sms_logs"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_links_reportId_key" ON "tracking_links"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_links_code_key" ON "tracking_links"("code");

-- CreateIndex
CREATE INDEX "tracking_links_expiresAt_idx" ON "tracking_links"("expiresAt");

-- CreateIndex
CREATE INDEX "incidents_status_issueType_createdAt_idx" ON "incidents"("status", "issueType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reference_key" ON "reports"("reference");

-- CreateIndex
CREATE INDEX "reports_citizenId_createdAt_idx" ON "reports"("citizenId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_incidentId_idx" ON "reports"("incidentId");

-- CreateIndex
CREATE INDEX "reports_dumpingSiteId_createdAt_idx" ON "reports"("dumpingSiteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_incidentId_key" ON "tickets"("incidentId");

-- CreateIndex
CREATE INDEX "tickets_crewId_status_idx" ON "tickets"("crewId", "status");

-- CreateIndex
CREATE INDEX "ticket_events_ticketId_createdAt_idx" ON "ticket_events"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "closure_approvals_status_idx" ON "closure_approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_deviceId_key" ON "vehicles"("deviceId");

-- CreateIndex
CREATE INDEX "position_logs_vehicleId_recordedAt_idx" ON "position_logs"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "routes_vehicleId_shiftStart_idx" ON "routes"("vehicleId", "shiftStart");

-- CreateIndex
CREATE INDEX "deviation_alerts_routeId_status_idx" ON "deviation_alerts"("routeId", "status");

-- CreateIndex
CREATE INDEX "route_audits_vehicleId_auditedAt_idx" ON "route_audits"("vehicleId", "auditedAt");

-- CreateIndex
CREATE UNIQUE INDEX "efficiency_index_zone_date_key" ON "efficiency_index"("zone", "date");

-- CreateIndex
CREATE INDEX "synced_actions_userId_status_createdAt_idx" ON "synced_actions"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "synced_actions_actionId_userId_key" ON "synced_actions"("actionId", "userId");

-- CreateIndex
CREATE INDEX "sync_conflicts_userId_createdAt_idx" ON "sync_conflicts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_dumpingSiteId_fkey" FOREIGN KEY ("dumpingSiteId") REFERENCES "dumping_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_approvals" ADD CONSTRAINT "closure_approvals_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dumping_remediations" ADD CONSTRAINT "dumping_remediations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "dumping_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_logs" ADD CONSTRAINT "position_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_alerts" ADD CONSTRAINT "deviation_alerts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_alerts" ADD CONSTRAINT "deviation_alerts_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_audits" ADD CONSTRAINT "route_audits_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
