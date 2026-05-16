import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameLoge, requireSameObedience, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, badRequest, notFound, conflict, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  const parts = event.path.replace(/.*\/loges\/?/, '').split('/').filter(Boolean)
  const id = parts[0] ?? null

  try {
    const user = await requireAuth(event)

    if (event.httpMethod === 'GET' && !id) return await listLoges(event, user)
    if (event.httpMethod === 'GET' && id) return await getLoge(id, user)
    if (event.httpMethod === 'POST') return await createLoge(event, user)
    if (event.httpMethod === 'PATCH' && id) return await updateLoge(id, event, user)
    if (event.httpMethod === 'DELETE' && id) return await deactivateLoge(id, user)

    return badRequest('Méthode non supportée')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// GET /api/loges
async function listLoges(event, user) {
  const q = event.queryStringParameters ?? {}
  const where = { obedienceId: user.obedienceId }
  if (q.statut) where.statut = q.statut
  if (q.ville) where.ville = { contains: q.ville, mode: 'insensitive' }

  const loges = await prisma.loge.findMany({
    where,
    include: {
      officiers: { include: { membre: { select: { id: true, nom: true } } } },
      _count: { select: { membres: true } },
    },
    orderBy: { numero: 'asc' },
  })

  return ok(loges)
}

// GET /api/loges/:id
async function getLoge(id, user) {
  const loge = await prisma.loge.findUnique({
    where: { id },
    include: {
      officiers: { include: { membre: { select: { id: true, nom: true, matricule: true } } } },
      membres: {
        select: { id: true, matricule: true, nom: true, grade: true, role: true, statut: true },
      },
      _count: { select: { membres: true, agendas: true, capitations: true } },
    },
  })

  if (!loge) return notFound('Loge introuvable')
  requireSameObedience(user, loge.obedienceId)
  requireSameLoge(user, loge.id)

  return ok(loge)
}

// POST /api/loges
async function createLoge(event, user) {
  requireRole(user, 'Grand Secrétaire')

  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { numero, nom, ville, email, tauxCap } = body
  if (!numero || !nom || !ville) return badRequest('numero, nom et ville requis')

  const existing = await prisma.loge.findUnique({
    where: { obedienceId_numero: { obedienceId: user.obedienceId, numero } },
  })
  if (existing) return conflict(`Loge n°${numero} déjà enregistrée`)

  const loge = await prisma.loge.create({
    data: {
      numero, nom, ville,
      email: email ?? null,
      tauxCap: tauxCap ?? null,
      obedienceId: user.obedienceId,
    },
  })

  return created(loge)
}

// PATCH /api/loges/:id
async function updateLoge(id, event, user) {
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const loge = await prisma.loge.findUnique({ where: { id } })
  if (!loge) return notFound('Loge introuvable')
  requireSameObedience(user, loge.obedienceId)
  requireSameLoge(user, loge.id)
  requireRole(user, 'VM')

  const data = {}
  const fields = ['nom', 'ville', 'statut', 'email', 'tauxCap', 'logoBase64']
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f]
  }

  // Mise à jour des officiers si fournis
  if (body.officiers) {
    requireRole(user, 'Grand Secrétaire')
    await prisma.officier.deleteMany({ where: { logeId: id } })
    await prisma.officier.createMany({
      data: body.officiers.map((o) => ({
        titre: o.titre,
        perm: o.perm ?? false,
        membreId: o.membreId ?? null,
        logeId: id,
      })),
    })
  }

  const updated = await prisma.loge.update({ where: { id }, data })
  return ok(updated)
}

// DELETE /api/loges/:id → désactivation
async function deactivateLoge(id, user) {
  requireRole(user, 'Grand Maître')

  const loge = await prisma.loge.findUnique({ where: { id } })
  if (!loge) return notFound('Loge introuvable')
  requireSameObedience(user, loge.obedienceId)

  await prisma.loge.update({ where: { id }, data: { statut: 'inactive' } })
  return ok({ ok: true, id })
}
