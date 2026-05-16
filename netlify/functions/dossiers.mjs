import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameLoge, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, noContent, badRequest, notFound, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  // Routes :
  //   /api/dossiers/candidats           GET / POST
  //   /api/dossiers/candidats/:id       PATCH / DELETE
  //   /api/dossiers/visiteurs           GET / POST
  //   /api/dossiers/visiteurs/:id       DELETE
  //   /api/dossiers/affiliations        GET / POST
  //   /api/dossiers/affiliations/:id    PATCH
  const rawPath = event.path.replace(/.*\/dossiers\/?/, '')
  const parts = rawPath.split('/').filter(Boolean)
  const section = parts[0]   // candidats | visiteurs | affiliations
  const id = parts[1] ?? null

  try {
    const user = await requireAuth(event)

    // ── Candidats ────────────────────────────────────────────────────────────
    if (section === 'candidats') {
      if (event.httpMethod === 'GET') return await listCandidats(event, user)
      if (event.httpMethod === 'POST') return await createCandidat(event, user)
      if (event.httpMethod === 'PATCH' && id) return await updateCandidat(id, event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteCandidat(id, user)
    }

    // ── Visiteurs ────────────────────────────────────────────────────────────
    if (section === 'visiteurs') {
      if (event.httpMethod === 'GET') return await listVisiteurs(event, user)
      if (event.httpMethod === 'POST') return await createVisiteur(event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteVisiteur(id, user)
    }

    // ── Affiliations ─────────────────────────────────────────────────────────
    if (section === 'affiliations') {
      if (event.httpMethod === 'GET') return await listAffiliations(event, user)
      if (event.httpMethod === 'POST') return await createAffiliation(event, user)
      if (event.httpMethod === 'PATCH' && id) return await updateAffiliation(id, event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteAffiliation(id, user)
    }

    return badRequest('Route inconnue')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// ─── CANDIDATS ────────────────────────────────────────────────────────────────

async function listCandidats(event, user) {
  requireRole(user, 'VM')
  const q = event.queryStringParameters ?? {}
  const logeId = q.logeId ?? user.logeId
  requireSameLoge(user, logeId)

  const where = { logeId }
  if (q.statut) where.statut = q.statut

  return ok(await prisma.dossier.findMany({ where, orderBy: { date: 'desc' } }))
}

async function createCandidat(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { nom, logeId, tel, email, grade, note, docs } = body
  if (!nom) return badRequest('nom requis')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const dossier = await prisma.dossier.create({
    data: {
      nom, logeId: logeIdTarget,
      tel: tel ?? null,
      email: email ?? null,
      grade: grade ?? null,
      note: note ?? null,
      docsJson: docs ?? { extrait: false, casier: false, nationalite: false },
      statut: body.statut ?? 'Incomplet',
    },
  })
  return created(dossier)
}

async function updateCandidat(id, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const dossier = await prisma.dossier.findUnique({ where: { id } })
  if (!dossier) return notFound('Dossier introuvable')
  requireSameLoge(user, dossier.logeId)

  const data = {}
  const fields = ['nom', 'tel', 'email', 'grade', 'note', 'statut']
  for (const f of fields) { if (body[f] !== undefined) data[f] = body[f] }
  if (body.docs !== undefined) data.docsJson = body.docs

  // Auto-calculer le statut si tous les docs sont présents
  if (data.docsJson) {
    const d = data.docsJson
    data.statut = (d.extrait && d.casier && d.nationalite) ? 'Complet' : 'Incomplet'
  }

  return ok(await prisma.dossier.update({ where: { id }, data }))
}

async function deleteCandidat(id, user) {
  requireRole(user, 'Grand Secrétaire')
  const dossier = await prisma.dossier.findUnique({ where: { id } })
  if (!dossier) return notFound('Dossier introuvable')
  requireSameLoge(user, dossier.logeId)
  await prisma.dossier.delete({ where: { id } })
  return noContent()
}

// ─── VISITEURS ────────────────────────────────────────────────────────────────

async function listVisiteurs(event, user) {
  const q = event.queryStringParameters ?? {}
  const logeId = q.logeId ?? user.logeId
  requireSameLoge(user, logeId)

  const where = { logeId }
  if (q.dateFrom) where.date = { gte: new Date(q.dateFrom) }

  return ok(await prisma.visiteur.findMany({ where, orderBy: { date: 'desc' } }))
}

async function createVisiteur(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { nom, loge, grade, date, logeId, motif } = body
  if (!nom || !loge || !grade || !date) return badRequest('nom, loge, grade, date requis')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const visiteur = await prisma.visiteur.create({
    data: {
      nom, loge, grade, motif: motif ?? null,
      date: new Date(date),
      logeId: logeIdTarget,
    },
  })
  return created(visiteur)
}

async function deleteVisiteur(id, user) {
  requireRole(user, 'VM')
  const v = await prisma.visiteur.findUnique({ where: { id } })
  if (!v) return notFound('Visiteur introuvable')
  requireSameLoge(user, v.logeId)
  await prisma.visiteur.delete({ where: { id } })
  return noContent()
}

// ─── AFFILIATIONS ─────────────────────────────────────────────────────────────

async function listAffiliations(event, user) {
  requireRole(user, 'VM')
  const q = event.queryStringParameters ?? {}
  const logeId = q.logeId ?? user.logeId
  requireSameLoge(user, logeId)

  const where = { logeId }
  if (q.statut) where.statut = q.statut

  return ok(await prisma.affiliation.findMany({ where, orderBy: { createdAt: 'desc' } }))
}

async function createAffiliation(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { nom, logeId, tel, email, grade, logeOrigin, obOrigin, dateAffil, note } = body
  if (!nom) return badRequest('nom requis')

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const aff = await prisma.affiliation.create({
    data: {
      nom, logeId: logeIdTarget,
      tel: tel ?? null, email: email ?? null,
      grade: grade ?? null,
      logeOrigin: logeOrigin ?? null,
      obOrigin: obOrigin ?? null,
      dateAffil: dateAffil ? new Date(dateAffil) : null,
      statut: body.statut ?? 'En attente',
      note: note ?? null,
    },
  })
  return created(aff)
}

async function updateAffiliation(id, event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const aff = await prisma.affiliation.findUnique({ where: { id } })
  if (!aff) return notFound('Affiliation introuvable')
  requireSameLoge(user, aff.logeId)

  const data = {}
  const fields = ['statut', 'note', 'grade', 'logeOrigin', 'obOrigin']
  for (const f of fields) { if (body[f] !== undefined) data[f] = body[f] }
  if (body.dateAffil !== undefined) data.dateAffil = body.dateAffil ? new Date(body.dateAffil) : null

  return ok(await prisma.affiliation.update({ where: { id }, data }))
}

async function deleteAffiliation(id, user) {
  requireRole(user, 'Grand Secrétaire')
  const aff = await prisma.affiliation.findUnique({ where: { id } })
  if (!aff) return notFound('Affiliation introuvable')
  requireSameLoge(user, aff.logeId)
  await prisma.affiliation.delete({ where: { id } })
  return noContent()
}
