-- CreateTable
CREATE TABLE "Obedience" (
    "id" TEXT NOT NULL,
    "acronyme" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "siege" TEXT NOT NULL,
    "fondation" TEXT,
    "tauxCap" INTEGER NOT NULL DEFAULT 50000,
    "tauxLoge" INTEGER NOT NULL DEFAULT 200000,
    "typeObedience" TEXT NOT NULL DEFAULT 'masculine',
    "adresse" TEXT,
    "patente" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "description" TEXT,
    "logoBase64" TEXT,
    "welcomeMsg" TEXT,
    "scrollMsg" TEXT,
    "themeJson" JSONB,
    "pdfHeaderJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obedience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loge" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'active',
    "email" TEXT,
    "tauxCap" INTEGER,
    "logoBase64" TEXT,
    "obedienceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membre" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'Apprenti',
    "dateGrade" TIMESTAMP(3),
    "dateInit" TIMESTAMP(3),
    "dateAugm" TIMESTAMP(3),
    "dateExalt" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'Frère',
    "passwordHash" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "tel" TEXT,
    "email" TEXT,
    "logeId" TEXT,
    "secondLogeId" TEXT,
    "obedienceId" TEXT NOT NULL,
    "affiliJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Officier" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "perm" BOOLEAN NOT NULL DEFAULT false,
    "membreId" TEXT,
    "logeId" TEXT NOT NULL,

    CONSTRAINT "Officier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandOfficier" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "membreId" TEXT,
    "obedienceId" TEXT NOT NULL,

    CONSTRAINT "GrandOfficier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agenda" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heure" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planche" TEXT,
    "presentateur" TEXT,
    "planStatus" TEXT,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "membreId" TEXT NOT NULL,
    "logeId" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capitation" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mnt" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "date" TIMESTAMP(3),
    "membreId" TEXT NOT NULL,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avance" (
    "id" TEXT NOT NULL,
    "mnt" INTEGER NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membreId" TEXT NOT NULL,
    "logeId" TEXT NOT NULL,
    "capitationId" TEXT,

    CONSTRAINT "Avance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Versement" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mnt" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "date" TIMESTAMP(3),
    "desc" TEXT,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Versement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visiteur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "loge" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "motif" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visiteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "tel" TEXT,
    "email" TEXT,
    "grade" TEXT,
    "note" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Incomplet',
    "docsJson" JSONB NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logeId" TEXT NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "tel" TEXT,
    "email" TEXT,
    "grade" TEXT,
    "logeOrigin" TEXT,
    "obOrigin" TEXT,
    "dateAffil" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "note" TEXT,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TroncVeuve" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mnt" INTEGER NOT NULL,
    "desc" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "logeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TroncVeuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'Tous',
    "date" TIMESTAMP(3) NOT NULL,
    "contenu" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "obedienceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandLogeTenue" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heure" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lieu" TEXT,
    "compteRendu" TEXT,
    "participants" JSONB NOT NULL,
    "obedienceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrandLogeTenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvocationGO" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heure" TEXT NOT NULL,
    "lieu" TEXT,
    "ordreJour" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "cr" TEXT,
    "obedienceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConvocationGO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnexionLog" (
    "id" TEXT NOT NULL,
    "heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT,
    "grade" TEXT,
    "ipAddr" TEXT,
    "membreId" TEXT NOT NULL,

    CONSTRAINT "ConnexionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Obedience_acronyme_key" ON "Obedience"("acronyme");

-- CreateIndex
CREATE UNIQUE INDEX "Loge_obedienceId_numero_key" ON "Loge"("obedienceId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Membre_matricule_key" ON "Membre"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_membreId_agendaId_key" ON "Presence"("membreId", "agendaId");

-- CreateIndex
CREATE UNIQUE INDEX "Capitation_membreId_logeId_annee_key" ON "Capitation"("membreId", "logeId", "annee");

-- AddForeignKey
ALTER TABLE "Loge" ADD CONSTRAINT "Loge_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membre" ADD CONSTRAINT "Membre_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membre" ADD CONSTRAINT "Membre_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membre" ADD CONSTRAINT "Membre_secondLogeId_fkey" FOREIGN KEY ("secondLogeId") REFERENCES "Loge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officier" ADD CONSTRAINT "Officier_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officier" ADD CONSTRAINT "Officier_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandOfficier" ADD CONSTRAINT "GrandOfficier_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandOfficier" ADD CONSTRAINT "GrandOfficier_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capitation" ADD CONSTRAINT "Capitation_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capitation" ADD CONSTRAINT "Capitation_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_capitationId_fkey" FOREIGN KEY ("capitationId") REFERENCES "Capitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visiteur" ADD CONSTRAINT "Visiteur_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TroncVeuve" ADD CONSTRAINT "TroncVeuve_logeId_fkey" FOREIGN KEY ("logeId") REFERENCES "Loge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandLogeTenue" ADD CONSTRAINT "GrandLogeTenue_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocationGO" ADD CONSTRAINT "ConvocationGO_obedienceId_fkey" FOREIGN KEY ("obedienceId") REFERENCES "Obedience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnexionLog" ADD CONSTRAINT "ConnexionLog_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
