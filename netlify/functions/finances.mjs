import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameLoge, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, noContent, badRequest, notFound, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  // Routes gérées :
  //   /api/finances/capitations              GET (liste) / POST (créer)
  //   /api/finances/capitations/:id          PATCH
  //   /api/finances/capitations/:id/avances  POST
  //   /api/finances/versements               GET / POST
  //   /api/finances/versements/:id           PATCH
  //   /api/finances/tronc                    GET / POST
  //   /api/finances/tronc/:id                DELETE
  const rawPath = event.path.replace(/.*\/finances\/?/, '')
  const parts = rawPath.split('/').filter(Boolean)
  const section = parts[0]    // capitations | versements | tronc
  const id = parts[1] ?? null
  const sub = parts[2] ?? null

  try {
    const user = await requireAuth(event)

    // ── Capitations ──────────────────────────────────────────────────────────
    if (section === 'capitations') {
      if (event.httpMethod === 'GET') return await listCapitations(event, user)
      if (event.httpMethod === 'POST' && !id) return await createCapitation(event, user)
      if (event.httpMethod === 'PATCH' && id && !sub) return await updateCapitation(id, event, user)
      if (event.httpMethod === 'POST' && id && sub === 'avances') return await addAvance(id, event, user)
    }

    // ── Versements ───────────────────────────────────────────────────────────
    if (section === 'versements') {
      if (event.httpMethod === 'GET') return await listVersements(event, user)
      if (event.httpMethod === 'POST' && !id) return await createVersement(event, user)
      if (event.httpMethod === 'PATCH' && id) return await updateVersement(id, event, user)
    }

    // ── Tronc de la Veuve ────────────────────────────────────────────────────
    if (section === 'tronc') {
      if (event.httpMethod === 'GET') return await listTronc(event, user)
      if (event.httpMethod === 'POST') return await createTroncEntry(event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteTroncEntry(id, user)
    }

    return badRequest('Route inconnue')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// ─── CAPITATIONS ──────────────────────────────────────────────────────────────

// GET /api/finances/capitations?logeId=&membreId=&annee=
async function listCapitations(event, user) {
  const q = event.queryStringParameters ?? {}
  const where = {}

  if (q.logeId) {
    requireSameLoge(user, q.logeId)
    where.logeId = q.logeId
  } else {
    where.logeId = user.logeId
  }

  if (q.membreId) where.membreId = q.membreId
  if (q.annee) where.annee = Number(q.annee)
  if (q.statut) where.statut = q.statut

  const caps = await prisma.capitation.findMany({
    where,
    include: {
      membre: { select: { id: true, nom: true, matricule: true } },
      avances: { orderBy: { date: 'asc' } },
    },
    orderBy: [{ annee: 'desc' }, { membre: { nom: 'asc' } }],
  })

  return ok(caps)
}

// POST /api/finances/capitations
async function createCapitation(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { membreId, logeId, annee, mnt, statut, date } = body
  if (!membreId || !annee || !mnt) return badRequest('membreId, annee, mnt requis')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const cap = await prisma.capitation.create({
    data: {
      membreId, annee: Number(annee), mnt: Number(mnt),
      logeId: logeIdTarget,
      statut: statut ?? 'En attente',
      date: date ? new Date(date) : null,
    },
  })

  return created(cap)
}

// PATCH /api/finances/capitations/:id
async function updateCapitation(id, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const cap = await prisma.capitation.findUnique({ where: { id } })
  if (!cap) return notFound('Capitation introuvable')
  requireSameLoge(user, cap.logeId)

  const data = {}
  if (body.mnt !== undefined) data.mnt = Number(body.mnt)
  if (body.statut !== undefined) data.statut = body.statut
  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null

  const updated = await prisma.capitation.update({ where: { id }, data })
  return ok(updated)
}

// POST /api/finances/capitations/:id/avances
async function addAvance(capitationId, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const cap = await prisma.capitation.findUnique({ where: { id: capitationId } })
  if (!cap) return notFound('Capitation introuvable')
  requireSameLoge(user, cap.logeId)

  const { mnt, note } = body
  if (!mnt) return badRequest('mnt requis')

  const avance = await prisma.avance.create({
    data: {
      mnt: Number(mnt),
      note: note ?? null,
      membreId: cap.membreId,
      logeId: cap.logeId,
      capitationId,
    },
  })

  // Recalculer le total et mettre à jour le statut
  const avances = await prisma.avance.aggregate({
    where: { capitationId },
    _sum: { mnt: true },
  })
  const totalPaye = avances._sum.mnt ?? 0
  const newStatut = totalPaye >= cap.mnt ? 'Payé' : 'En attente'
  await prisma.capitation.update({
    where: { id: capitationId },
    data: { statut: newStatut, date: newStatut === 'Payé' ? new Date() : cap.date },
  })

  return created(avance)
}

// ─── VERSEMENTS ───────────────────────────────────────────────────────────────

// GET /api/finances/versements?logeId=&annee=
async function listVersements(event, user) {
  const q = event.queryStringParameters ?? {}
  const logeId = q.logeId ?? user.logeId
  requireSameLoge(user, logeId)

  const where = { logeId }
  if (q.annee) where.annee = Number(q.annee)
  if (q.statut) where.statut = q.statut

  const versements = await prisma.versement.findMany({
    where,
    orderBy: [{ annee: 'desc' }, { createdAt: 'desc' }],
  })

  return ok(versements)
}

// POST /api/finances/versements
async function createVersement(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { logeId, annee, mnt, desc, statut, date } = body
  if (!annee || !mnt) return badRequest('annee et mnt requis')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const v = await prisma.versement.create({
    data: {
      logeId: logeIdTarget,
      annee: Number(annee),
      mnt: Number(mnt),
      desc: desc ?? null,
      statut: statut ?? 'En attente',
      date: date ? new Date(date) : null,
    },
  })

  return created(v)
}

// PATCH /api/finances/versements/:id
async function updateVersement(id, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const v = await prisma.versement.findUnique({ where: { id } })
  if (!v) return notFound('Versement introuvable')
  requireSameLoge(user, v.logeId)

  const data = {}
  if (body.mnt !== undefined) data.mnt = Number(body.mnt)
  if (body.statut !== undefined) data.statut = body.statut
  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null
  if (body.desc !== undefined) data.desc = body.desc

  const updated = await prisma.versement.update({ where: { id }, data })
  return ok(updated)
}

// ─── TRONC DE LA VEUVE ────────────────────────────────────────────────────────

// GET /api/finances/tronc?logeId=
async function listTronc(event, user) {
  const q = event.queryStringParameters ?? {}
  const logeId = q.logeId ?? user.logeId
  requireSameLoge(user, logeId)

  const entries = await prisma.troncVeuve.findMany({
    where: { logeId },
    orderBy: { date: 'desc' },
  })

  // Solde calculé
  const solde = entries.reduce((acc, e) => {
    return e.type === 'Recette' ? acc + e.mnt : acc - e.mnt
  }, 0)

  return ok({ entries, solde })
}

// POST /api/finances/tronc
async function createTroncEntry(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { logeId, type, mnt, desc, date } = body
  if (!type || !mnt || !date) return badRequest('type, mnt, date requis')
  if (!['Recette', 'Dépense'].includes(type)) return badRequest('type doit être Recette ou Dépense')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const entry = await prisma.troncVeuve.create({
    data: {
      logeId: logeIdTarget,
      type, mnt: Number(mnt),
      desc: desc ?? null,
      date: new Date(date),
    },
  })

  return created(entry)
}

// DELETE /api/finances/tronc/:id
async function deleteTroncEntry(id, user) {
  requireRole(user, 'Grand Secrétaire')

  const entry = await prisma.troncVeuve.findUnique({ where: { id } })
  if (!entry) return notFound('Entrée introuvable')
  requireSameLoge(user, entry.logeId)

  await prisma.troncVeuve.delete({ where: { id } })
  return noContent()
}
