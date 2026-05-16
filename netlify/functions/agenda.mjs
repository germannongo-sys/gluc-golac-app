import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameLoge, requireSameObedience, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, noContent, badRequest, notFound, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  // Patterns supportés :
  //   /api/agenda                  → liste tous (filtré)
  //   /api/agenda/:id              → détail / update / delete
  //   /api/agenda/:id/presences    → présences d'une tenue
  const rawPath = event.path.replace(/.*\/agenda\/?/, '')
  const parts = rawPath.split('/').filter(Boolean)
  const id = parts[0] ?? null
  const sub = parts[1] ?? null  // "presences"

  try {
    const user = await requireAuth(event)

    // Présences
    if (id && sub === 'presences') {
      if (event.httpMethod === 'GET') return await getPresences(id, user)
      if (event.httpMethod === 'PUT') return await setPresences(id, event, user)
    }

    // Agenda CRUD
    if (event.httpMethod === 'GET' && !id) return await listAgenda(event, user)
    if (event.httpMethod === 'GET' && id) return await getAgendaItem(id, user)
    if (event.httpMethod === 'POST') return await createAgendaItem(event, user)
    if (event.httpMethod === 'PATCH' && id) return await updateAgendaItem(id, event, user)
    if (event.httpMethod === 'DELETE' && id) return await deleteAgendaItem(id, user)

    return badRequest('Route inconnue')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// GET /api/agenda?logeId=&annee=
async function listAgenda(event, user) {
  const q = event.queryStringParameters ?? {}
  const where = {}

  if (q.logeId) {
    const loge = await prisma.loge.findUnique({ where: { id: q.logeId } })
    if (!loge) return notFound('Loge introuvable')
    requireSameObedience(user, loge.obedienceId)
    requireSameLoge(user, q.logeId)
    where.logeId = q.logeId
  } else {
    // Retourner uniquement la loge de l'utilisateur
    where.logeId = user.logeId
  }

  if (q.annee) {
    where.date = {
      gte: new Date(`${q.annee}-01-01`),
      lt: new Date(`${Number(q.annee) + 1}-01-01`),
    }
  }
  if (q.type) where.type = q.type

  const items = await prisma.agenda.findMany({
    where,
    include: {
      _count: { select: { presences: true } },
    },
    orderBy: { date: 'desc' },
  })

  return ok(items)
}

// GET /api/agenda/:id
async function getAgendaItem(id, user) {
  const item = await prisma.agenda.findUnique({
    where: { id },
    include: {
      presences: {
        include: { membre: { select: { id: true, nom: true, matricule: true, grade: true } } },
      },
    },
  })
  if (!item) return notFound('Tenue introuvable')

  const loge = await prisma.loge.findUnique({ where: { id: item.logeId } })
  requireSameObedience(user, loge.obedienceId)
  requireSameLoge(user, item.logeId)

  return ok(item)
}

// POST /api/agenda
async function createAgendaItem(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { titre, date, heure, type, logeId, planche, presentateur } = body
  if (!titre || !date || !heure || !type) return badRequest('titre, date, heure, type requis')

  const logeIdTarget = logeId ?? user.logeId
  const loge = await prisma.loge.findUnique({ where: { id: logeIdTarget } })
  if (!loge) return notFound('Loge introuvable')
  requireSameLoge(user, logeIdTarget)

  const item = await prisma.agenda.create({
    data: {
      titre, heure, type,
      date: new Date(date),
      logeId: logeIdTarget,
      planche: planche ?? null,
      presentateur: presentateur ?? null,
    },
  })

  return created(item)
}

// PATCH /api/agenda/:id
async function updateAgendaItem(id, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const item = await prisma.agenda.findUnique({ where: { id } })
  if (!item) return notFound('Tenue introuvable')
  requireSameLoge(user, item.logeId)

  const data = {}
  const fields = ['titre', 'heure', 'type', 'planche', 'presentateur', 'planStatus']
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f]
  }
  if (body.date) data.date = new Date(body.date)

  const updated = await prisma.agenda.update({ where: { id }, data })
  return ok(updated)
}

// DELETE /api/agenda/:id
async function deleteAgendaItem(id, user) {
  requireRole(user, 'VM')

  const item = await prisma.agenda.findUnique({ where: { id } })
  if (!item) return notFound('Tenue introuvable')
  requireSameLoge(user, item.logeId)

  await prisma.agenda.delete({ where: { id } })
  return noContent()
}

// GET /api/agenda/:id/presences
async function getPresences(agendaId, user) {
  const item = await prisma.agenda.findUnique({ where: { id: agendaId } })
  if (!item) return notFound('Tenue introuvable')
  requireSameLoge(user, item.logeId)

  const presences = await prisma.presence.findMany({
    where: { agendaId },
    include: {
      membre: { select: { id: true, nom: true, matricule: true, grade: true } },
    },
  })

  return ok(presences)
}

// PUT /api/agenda/:id/presences
// Body: { presences: [{ membreId, present }] }
async function setPresences(agendaId, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body?.presences) return badRequest('presences[] requis')

  const item = await prisma.agenda.findUnique({ where: { id: agendaId } })
  if (!item) return notFound('Tenue introuvable')
  requireSameLoge(user, item.logeId)

  // Upsert en masse
  await Promise.all(
    body.presences.map(({ membreId, present }) =>
      prisma.presence.upsert({
        where: { membreId_agendaId: { membreId, agendaId } },
        update: { present: Boolean(present) },
        create: { membreId, agendaId, logeId: item.logeId, present: Boolean(present) },
      })
    )
  )

  return ok({ ok: true, count: body.presences.length })
}
