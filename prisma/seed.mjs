/**
 * Seed de démonstration — reprend les données de buildData() du frontend.
 * Usage : node prisma/seed.mjs  (ou npm run db:seed)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const hash = (pwd) => bcrypt.hash(pwd, 12)

async function main() {
  console.log('Seed démo GLUC + GOLAC…')

  // ─── GLUC ─────────────────────────────────────────────────────────────────
  const gluc = await prisma.obedience.upsert({
    where: { acronyme: 'GLUC' },
    update: {},
    create: {
      acronyme: 'GLUC',
      nom: 'Grande Loge Unie du Congo',
      siege: 'Brazzaville',
      fondation: '1995',
      tauxCap: 50000,
      tauxLoge: 200000,
      typeObedience: 'masculine',
      adresse: 'Avenue de la Paix, Brazzaville',
      tel: '+242 06 000 0000',
      email: 'contact@gluc.cg',
    },
  })

  // Loges GLUC
  const loge1 = await prisma.loge.upsert({
    where: { obedienceId_numero: { obedienceId: gluc.id, numero: '001' } },
    update: {},
    create: { numero: '001', nom: "Lumière d'Orient", ville: 'Brazzaville', obedienceId: gluc.id },
  })
  const loge2 = await prisma.loge.upsert({
    where: { obedienceId_numero: { obedienceId: gluc.id, numero: '002' } },
    update: {},
    create: { numero: '002', nom: 'Étoile du Congo', ville: 'Pointe-Noire', obedienceId: gluc.id },
  })

  // Membres GLUC
  const membresGluc = [
    { matricule: 'GLUC-00', nom: 'Albert Moukouéké', grade: 'Maitre', role: 'Grand Maître', pwd: 'admin2026', logeId: loge1.id },
    { matricule: 'GLUC-GS', nom: 'Bernard Ossomba',  grade: 'Maitre', role: 'Grand Secrétaire', pwd: 'gs2026', logeId: loge1.id },
    { matricule: 'F-001',   nom: 'Jean Mukulu',       grade: 'Maitre', role: 'VM',     pwd: 'vm1234',    logeId: loge1.id },
    { matricule: 'F-002',   nom: 'Pierre Loemba',     grade: 'Maitre', role: 'Officier', pwd: '1234',    logeId: loge1.id },
    { matricule: 'F-003',   nom: 'Marc Yamba',        grade: 'Apprenti', role: 'Frère', pwd: '1234',     logeId: loge1.id },
    { matricule: 'F-004',   nom: 'Paul Ndinga',       grade: 'Compagnon', role: 'Frère', pwd: '1234',    logeId: loge1.id },
    { matricule: 'F-005',   nom: 'Simon Moungounga',  grade: 'Maitre', role: 'Frère',  pwd: '1234',      logeId: loge1.id },
    { matricule: 'F-006',   nom: 'André Mabiala',     grade: 'Maitre', role: 'VM',     pwd: 'vm5678',    logeId: loge2.id },
    { matricule: 'F-007',   nom: 'Louis Nkouka',      grade: 'Maitre', role: 'Officier', pwd: '1234',    logeId: loge2.id },
    { matricule: 'F-008',   nom: 'Jacques Bitsindou', grade: 'Compagnon', role: 'Frère', pwd: '1234',    logeId: loge2.id },
    { matricule: 'F-009',   nom: 'Robert Mouamba',    grade: 'Apprenti', role: 'Frère', pwd: '1234',     logeId: loge2.id },
    { matricule: 'F-010',   nom: 'Charles Louzolo',   grade: 'Maitre', role: 'Frère',  pwd: '1234',      logeId: loge2.id },
  ]

  const membreIds = {}
  for (const m of membresGluc) {
    const membre = await prisma.membre.upsert({
      where: { matricule: m.matricule },
      update: {},
      create: {
        matricule: m.matricule,
        nom: m.nom,
        grade: m.grade,
        role: m.role,
        passwordHash: await hash(m.pwd),
        logeId: m.logeId,
        obedienceId: gluc.id,
        statut: 'actif',
        dateInit: new Date('2020-03-15'),
        dateGrade: new Date('2022-06-10'),
      },
    })
    membreIds[m.matricule] = membre.id
  }

  // Grands Officiers GLUC
  await prisma.grandOfficier.deleteMany({ where: { obedienceId: gluc.id } })
  await prisma.grandOfficier.createMany({
    data: [
      { titre: 'Grand Maître', membreId: membreIds['GLUC-00'], obedienceId: gluc.id },
      { titre: 'Grand Secrétaire', membreId: membreIds['GLUC-GS'], obedienceId: gluc.id },
      { titre: 'Grand Trésorier', membreId: null, obedienceId: gluc.id },
      { titre: 'Grand Orateur', membreId: null, obedienceId: gluc.id },
    ],
  })

  // Officiers des loges
  await prisma.officier.deleteMany({ where: { logeId: loge1.id } })
  await prisma.officier.createMany({
    data: [
      { titre: 'VM',         membreId: membreIds['F-001'], logeId: loge1.id, perm: true },
      { titre: 'Secrétaire', membreId: membreIds['F-002'], logeId: loge1.id },
      { titre: 'Trésorier',  membreId: null,               logeId: loge1.id },
      { titre: 'Orateur',    membreId: null,               logeId: loge1.id },
    ],
  })
  await prisma.officier.deleteMany({ where: { logeId: loge2.id } })
  await prisma.officier.createMany({
    data: [
      { titre: 'VM',         membreId: membreIds['F-006'], logeId: loge2.id, perm: true },
      { titre: 'Secrétaire', membreId: membreIds['F-007'], logeId: loge2.id },
    ],
  })

  // Agenda loge 1
  const tenue1 = await prisma.agenda.create({
    data: {
      titre: 'Tenue ordinaire — Mars 2026',
      date: new Date('2026-03-15T19:00:00'),
      heure: '19h00', type: 'Tenue',
      planche: 'La Franc-Maçonnerie et l\'unité africaine',
      presentateur: 'F. Jean Mukulu', planStatus: 'Présentée',
      logeId: loge1.id,
    },
  })
  const tenue2 = await prisma.agenda.create({
    data: {
      titre: 'Tenue d\'instruction — Avril 2026',
      date: new Date('2026-04-05T18:30:00'),
      heure: '18h30', type: "Tenue d'instruction",
      logeId: loge1.id,
    },
  })

  // Présences
  for (const mat of ['F-001', 'F-002', 'F-003', 'F-004', 'F-005']) {
    if (!membreIds[mat]) continue
    await prisma.presence.upsert({
      where: { membreId_agendaId: { membreId: membreIds[mat], agendaId: tenue1.id } },
      update: {},
      create: { membreId: membreIds[mat], agendaId: tenue1.id, logeId: loge1.id, present: true },
    })
  }

  // Capitations GLUC 2025
  const annee = 2025
  for (const mat of ['F-001', 'F-002', 'F-003', 'F-004', 'F-005']) {
    await prisma.capitation.upsert({
      where: { membreId_logeId_annee: { membreId: membreIds[mat], logeId: loge1.id, annee } },
      update: {},
      create: {
        membreId: membreIds[mat], logeId: loge1.id, annee,
        mnt: 50000,
        statut: mat === 'F-001' ? 'Payé' : 'En attente',
        date: mat === 'F-001' ? new Date('2025-01-10') : null,
      },
    })
  }

  // Versement loge 1
  await prisma.versement.create({
    data: { logeId: loge1.id, annee: 2025, mnt: 200000, statut: 'Payé', date: new Date('2025-02-01'), desc: 'Cotisation annuelle' },
  })

  // Tronc de la Veuve loge 1
  await prisma.troncVeuve.createMany({
    data: [
      { logeId: loge1.id, type: 'Recette', mnt: 25000, desc: 'Collecte tenue mars', date: new Date('2026-03-15') },
      { logeId: loge1.id, type: 'Dépense', mnt: 10000, desc: 'Aide famille frère Yamba', date: new Date('2026-03-20') },
    ],
  })

  // Visiteur loge 1
  await prisma.visiteur.create({
    data: { logeId: loge1.id, nom: 'Frère Kabila', loge: 'Loge Orient de Kinshasa', grade: 'Maitre', motif: 'Visite fraternelle', date: new Date('2026-03-15') },
  })

  // Dossier candidat loge 1
  await prisma.dossier.create({
    data: {
      logeId: loge1.id, nom: 'Théodore Nganga', tel: '+242 06 111 2222',
      grade: 'Apprenti',
      docsJson: { extrait: true, casier: true, nationalite: false },
      statut: 'Incomplet', note: 'En attente du certificat de nationalité',
    },
  })

  // Document obédience
  await prisma.document.create({
    data: {
      obedienceId: gluc.id,
      titre: 'Règlement Général GLUC', type: 'Règlement', grade: 'Tous',
      date: new Date('2020-01-01'),
      contenu: 'Règlement général de la Grande Loge Unie du Congo.',
    },
  })

  // Grande Loge Tenue
  await prisma.grandLogeTenue.create({
    data: {
      obedienceId: gluc.id, titre: 'Grande Loge Annuelle 2025',
      date: new Date('2025-11-15'), heure: '10h00', type: 'Grande Loge',
      lieu: 'Temple de Brazzaville',
      participants: [membreIds['GLUC-00'], membreIds['GLUC-GS']].filter(Boolean),
    },
  })

  // ─── GOLAC ────────────────────────────────────────────────────────────────
  const golac = await prisma.obedience.upsert({
    where: { acronyme: 'GOLAC' },
    update: {},
    create: {
      acronyme: 'GOLAC',
      nom: 'Grande Obédience des Loges Africaines du Congo',
      siege: 'Brazzaville',
      fondation: '2005',
      tauxCap: 40000,
      tauxLoge: 180000,
      typeObedience: 'mixte',
      email: 'contact@golac.cg',
    },
  })

  const logeG1 = await prisma.loge.upsert({
    where: { obedienceId_numero: { obedienceId: golac.id, numero: '001' } },
    update: {},
    create: { numero: '001', nom: 'Équité et Fraternité', ville: 'Brazzaville', obedienceId: golac.id },
  })

  await prisma.membre.upsert({
    where: { matricule: 'GOLAC-GM' },
    update: {},
    create: {
      matricule: 'GOLAC-GM', nom: 'Marie Bouanga', grade: 'Maitre', role: 'Grand Maître',
      passwordHash: await hash('gm_golac2026'),
      logeId: logeG1.id, obedienceId: golac.id, statut: 'actif',
    },
  })

  console.log('✓ Seed terminé.')
  console.log()
  console.log('Comptes de démonstration GLUC :')
  console.log('  GLUC-00 / admin2026  → Grand Maître')
  console.log('  GLUC-GS / gs2026     → Grand Secrétaire')
  console.log('  F-001   / vm1234     → VM Loge 001')
  console.log('  F-003   / 1234       → Apprenti Loge 001')
  console.log()
  console.log('Comptes de démonstration GOLAC :')
  console.log('  GOLAC-GM / gm_golac2026 → Grand Maître')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
