/**
 * Script de migration : importe un export JSON du localStorage GLUC/GOLAC
 * vers la base PostgreSQL via Prisma.
 *
 * Usage:
 *   node scripts/migrate.mjs <chemin-vers-export.json> [--dry-run]
 *
 * Comment exporter depuis le navigateur :
 *   1. Ouvrir la console du navigateur sur l'app GLUC/GOLAC
 *   2. Copier : JSON.stringify(JSON.parse(localStorage.GLUC_STATE), null, 2)
 *   3. Sauvegarder dans un fichier .json
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const filePath = args.find((a) => !a.startsWith('--'))
const isDryRun = args.includes('--dry-run')

if (!filePath) {
  console.error('Usage: node scripts/migrate.mjs <export.json> [--dry-run]')
  process.exit(1)
}

const prisma = new PrismaClient()
const raw = JSON.parse(readFileSync(resolve(filePath), 'utf-8'))

console.log(`\n=== Migration GLUC/GOLAC → PostgreSQL ===`)
console.log(`Fichier : ${filePath}`)
console.log(`Mode    : ${isDryRun ? 'DRY RUN (aucune écriture)' : 'PRODUCTION'}`)
console.log(`Obédience détectée : ${raw.acronym ?? raw.obInfo?.acronym}`)
console.log()

async function run() {
  // ─── 1. Obédience ─────────────────────────────────────────────────────────
  const info = raw.obInfo ?? {}
  const obData = {
    acronyme: raw.acronym ?? info.acronym ?? 'INCONNU',
    nom: raw.name ?? info.name ?? 'Inconnue',
    siege: raw.siege ?? info.siege ?? '',
    fondation: raw.fondation ?? info.fondation ?? null,
    tauxCap: raw.tauxCap ?? 50000,
    tauxLoge: raw.tauxLoge ?? 200000,
    typeObedience: info.typeObedience ?? 'masculine',
    adresse: info.adresse ?? null,
    patente: info.patente ?? null,
    tel: info.tel ?? null,
    email: info.email ?? null,
    description: info.description ?? null,
    logoBase64: raw.logoObedience ?? null,
    welcomeMsg: info.welcomeMsg ?? null,
    scrollMsg: info.scrollMsg ?? null,
    themeJson: raw.themeColors ?? null,
    pdfHeaderJson: raw.pdfHeader ?? null,
  }

  console.log(`[1/7] Obédience : ${obData.acronyme} - ${obData.nom}`)
  if (isDryRun) { console.log('      → SKIP (dry-run)') }

  let ob
  if (!isDryRun) {
    ob = await prisma.obedience.upsert({
      where: { acronyme: obData.acronyme },
      update: obData,
      create: obData,
    })
    console.log(`      ✓ id=${ob.id}`)
  }
  const obId = ob?.id ?? 'DRY_RUN_OB_ID'

  // ─── 2. Loges ─────────────────────────────────────────────────────────────
  const loges = raw.loges ?? []
  console.log(`\n[2/7] Loges : ${loges.length}`)

  const logeIdMap = {}
  for (const l of loges) {
    const logeData = {
      numero: l.numero ?? l.id,
      nom: l.nom,
      ville: l.ville ?? '',
      statut: l.statut ?? 'active',
      email: l.email ?? null,
      tauxCap: l.tauxCap ?? null,
      logoBase64: l.logo ?? null,
      obedienceId: obId,
    }
    console.log(`      • L${logeData.numero} - ${logeData.nom} (${logeData.ville})`)
    if (!isDryRun) {
      const loge = await prisma.loge.upsert({
        where: { obedienceId_numero: { obedienceId: obId, numero: logeData.numero } },
        update: logeData,
        create: logeData,
      })
      logeIdMap[l.id] = loge.id
      console.log(`        ✓ id=${loge.id}`)

      // Officiers de la loge
      if (l.officiers?.length) {
        await prisma.officier.deleteMany({ where: { logeId: loge.id } })
        await prisma.officier.createMany({
          data: l.officiers.map((o) => ({
            titre: o.titre,
            perm: o.perm ?? false,
            logeId: loge.id,
          })),
        })
      }
    }
  }

  // ─── 3. Membres ───────────────────────────────────────────────────────────
  const membres = raw.membres ?? []
  console.log(`\n[3/7] Membres : ${membres.length}`)

  const membreIdMap = {}
  for (const m of membres) {
    const logeId = logeIdMap[m.logeId] ?? null
    const secondLogeId = logeIdMap[m.secondLogeId] ?? null
    const passwordHash = isDryRun ? 'DRY_RUN' : await bcrypt.hash(m.pwd ?? 'changeme2026', 12)

    const memData = {
      matricule: m.matricule,
      nom: m.nom,
      grade: m.grade ?? 'Apprenti',
      role: m.role ?? 'Frère',
      passwordHash,
      statut: m.statut ?? 'actif',
      tel: m.tel ?? null,
      email: m.email ?? null,
      logeId,
      secondLogeId,
      obedienceId: obId,
      dateGrade: m.dateGrade ? new Date(m.dateGrade) : null,
      dateInit: m.dateInit ? new Date(m.dateInit) : null,
      dateAugm: m.dateAugm ? new Date(m.dateAugm) : null,
      dateExalt: m.dateExalt ? new Date(m.dateExalt) : null,
      affiliJson: m.affiliation ?? null,
    }

    console.log(`      • ${memData.matricule} - ${memData.nom} (${memData.grade})`)
    if (!isDryRun) {
      const membre = await prisma.membre.upsert({
        where: { matricule: memData.matricule },
        update: memData,
        create: memData,
      })
      membreIdMap[m.id] = membre.id
      console.log(`        ✓ id=${membre.id}`)
    }
  }

  // Lier les officiers aux membres maintenant que les IDs sont connus
  if (!isDryRun) {
    for (const l of loges) {
      const logeId = logeIdMap[l.id]
      if (!logeId || !l.officiers?.length) continue
      for (const o of l.officiers) {
        if (o.mid && membreIdMap[o.mid]) {
          await prisma.officier.updateMany({
            where: { logeId, titre: o.titre },
            data: { membreId: membreIdMap[o.mid] },
          })
        }
      }
    }
  }

  // ─── 4. Capitations ───────────────────────────────────────────────────────
  const caps = raw.caps ?? []
  console.log(`\n[4/7] Capitations : ${caps.length}`)
  if (!isDryRun) {
    for (const c of caps) {
      const membreId = membreIdMap[c.mid]
      const logeId = logeIdMap[c.lid]
      if (!membreId || !logeId) { console.log(`      ⚠ SKIP cap ${c.id} — membre ou loge manquant`); continue }

      await prisma.capitation.upsert({
        where: { membreId_logeId_annee: { membreId, logeId, annee: Number(c.annee) } },
        update: { mnt: c.mnt, statut: c.st ?? 'En attente', date: c.date ? new Date(c.date) : null },
        create: { membreId, logeId, annee: Number(c.annee), mnt: c.mnt, statut: c.st ?? 'En attente', date: c.date ? new Date(c.date) : null },
      })
    }
    console.log(`      ✓ ${caps.length} capitations importées`)
  }

  // ─── 5. Versements ────────────────────────────────────────────────────────
  const versements = raw.versements ?? []
  console.log(`\n[5/7] Versements : ${versements.length}`)
  if (!isDryRun) {
    for (const v of versements) {
      const logeId = logeIdMap[v.lid]
      if (!logeId) { console.log(`      ⚠ SKIP versement ${v.id}`); continue }
      await prisma.versement.create({
        data: { logeId, annee: Number(v.annee), mnt: v.mnt, statut: v.st ?? 'En attente', desc: v.desc ?? null, date: v.date ? new Date(v.date) : null },
      })
    }
    console.log(`      ✓ ${versements.length} versements importés`)
  }

  // ─── 6. Agenda + Présences ────────────────────────────────────────────────
  let totalAgenda = 0
  let totalPresences = 0
  console.log(`\n[6/7] Agenda & Présences`)
  if (!isDryRun) {
    for (const l of loges) {
      const logeId = logeIdMap[l.id]
      if (!logeId) continue
      for (const a of l.agenda ?? []) {
        const agenda = await prisma.agenda.create({
          data: {
            titre: a.titre, heure: a.heure, type: a.type,
            date: new Date(a.date), logeId,
            planche: a.planche ?? null,
            presentateur: a.presentateur ?? null,
            planStatus: a.planStatus ?? null,
          },
        })
        totalAgenda++

        const agendaPresences = (raw.presences ?? []).filter((p) => p.evtId === a.id)
        for (const p of agendaPresences) {
          const membreId = membreIdMap[p.mid]
          if (!membreId) continue
          await prisma.presence.upsert({
            where: { membreId_agendaId: { membreId, agendaId: agenda.id } },
            update: { present: Boolean(p.present) },
            create: { membreId, agendaId: agenda.id, logeId, present: Boolean(p.present) },
          })
          totalPresences++
        }
      }
    }
    console.log(`      ✓ ${totalAgenda} tenues, ${totalPresences} présences`)
  }

  // ─── 7. Tronc de la Veuve ────────────────────────────────────────────────
  let totalTronc = 0
  console.log(`\n[7/7] Tronc de la Veuve`)
  if (!isDryRun) {
    for (const l of loges) {
      const logeId = logeIdMap[l.id]
      if (!logeId) continue
      const entries = (raw.troncVeuve ?? []).filter((t) => t.lid === l.id)
      for (const t of entries) {
        await prisma.troncVeuve.create({
          data: { logeId, type: t.type, mnt: t.mnt, desc: t.desc ?? null, date: new Date(t.date) },
        })
        totalTronc++
      }
    }
    console.log(`      ✓ ${totalTronc} entrées Tronc`)
  }

  console.log(`\n${'='.repeat(44)}`)
  console.log(isDryRun ? '✓ DRY RUN terminé — aucune donnée écrite.' : '✓ Migration terminée avec succès !')
  console.log()
}

run()
  .catch((e) => { console.error('ERREUR MIGRATION :', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
