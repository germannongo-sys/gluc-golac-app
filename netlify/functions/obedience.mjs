import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameObedience, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, noContent, badRequest, notFound, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  // Routes :
  //   /api/obedience                          GET / PATCH
  //   /api/obedience/grands-officiers         GET / PUT (remplacement complet)
  //   /api/obedience/grande-loge              GET / POST
  //   /api/obedience/grande-loge/:id          PATCH / DELETE
  //   /api/obedience/convocations             GET / POST
  //   /api/obedience/convocations/:id         PATCH / DELETE
  const rawPath = event.path.replace(/.*\/obedience\/?/, '')
  const parts = rawPath.split('/').filter(Boolean)
  const section = parts[0] ?? null  // 'grands-officiers' | 'grande-loge' | 'convocations' | null
  const id = parts[1] ?? null

  try {
    const user = await requireAuth(event)

    // ── Obédience elle-même ──────────────────────────────────────────────────
    if (!section) {
      if (event.httpMethod === 'GET') return await getObedience(user)
      if (event.httpMethod === 'PATCH') return await updateObedience(event, user)
    }

    // ── Grands Officiers ─────────────────────────────────────────────────────
    if (section === 'grands-officiers') {
      if (event.httpMethod === 'GET') return await getGrandsOfficiers(user)
      if (event.httpMethod === 'PUT') return await setGrandsOfficiers(event, user)
    }

    // ── Grande Loge Tenues ───────────────────────────────────────────────────
    if (section === 'grande-loge') {
      if (event.httpMethod === 'GET' && !id) return await listGrandeLogeTenues(event, user)
      if (event.httpMethod === 'POST' && !id) return await createGrandeLogeTenue(event, user)
      if (event.httpMethod === 'PATCH' && id) return await updateGrandeLogeTenue(id, event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteGrandeLogeTenue(id, user)
    }

    // ── Convocations Grands Officiers ────────────────────────────────────────
    if (section === 'convocations') {
      if (event.httpMethod === 'GET' && !id) return await listConvocations(event, user)
      if (event.httpMethod === 'POST' && !id) return await createConvocation(event, user)
      if (event.httpMethod === 'PATCH' && id) return await updateConvocation(id, event, user)
      if (event.httpMethod === 'DELETE' && id) return await deleteConvocation(id, user)
    }

    return badRequest('Route inconnue')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// ─── OBÉDIENCE ────────────────────────────────────────────────────────────────

async function getObedience(user) {
  const ob = await prisma.obedience.findUnique({
    where: { id: user.obedienceId },
    include: {
      grandOfficiers: {
        include: { membre: { select: { id: true, nom: true, matricule: true } } },
        orderBy: { titre: 'asc' },
      },
      _count: { select: { loges: true, membres: true } },
    },
  })
  if (!ob) return notFound('Obédience introuvable')
  return ok(ob)
}

async function updateObedience(event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const data = {}
  const fields = [
    'nom', 'siege', 'fondation', 'tauxCap', 'tauxLoge', 'typeObedience',
    'adresse', 'patente', 'tel', 'email', 'description',
    'logoBase64', 'welcomeMsg', 'scrollMsg', 'themeJson', 'pdfHeaderJson',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f]
  }

  const updated = await prisma.obedience.update({ where: { id: user.obedienceId }, data })
  return ok(updated)
}

// ─── GRANDS OFFICIERS ─────────────────────────────────────────────────────────

async function getGrandsOfficiers(user) {
  const gos = await prisma.grandOfficier.findMany({
    where: { obedienceId: user.obedienceId },
    include: { membre: { select: { id: true, nom: true, matricule: true, grade: true } } },
    orderBy: { titre: 'asc' },
  })
  return ok(gos)
}

// PUT /api/obedience/grands-officiers → remplace la liste complète
async function setGrandsOfficiers(event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body?.officiers) return badRequest('officiers[] requis')

  await prisma.grandOfficier.deleteMany({ where: { obedienceId: user.obedienceId } })

  const created_ = await prisma.grandOfficier.createMany({
    data: body.officiers.map((o) => ({
      titre: o.titre,
      membreId: o.membreId ?? null,
      obedienceId: user.obedienceId,
    })),
  })

  return ok({ count: created_.count })
}

// ─── GRANDE LOGE TENUES ───────────────────────────────────────────────────────

async function listGrandeLogeTenues(event, user) {
  const q = event.queryStringParameters ?? {}
  const where = { obedienceId: user.obedienceId }
  if (q.annee) {
    where.date = {
      gte: new Date(`${q.annee}-01-01`),
      lt: new Date(`${Number(q.annee) + 1}-01-01`),
    }
  }

  const tenues = await prisma.grandLogeTenue.findMany({
    where,
    orderBy: { date: 'desc' },
  })
  return ok(tenues)
}

async function createGrandeLogeTenue(event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { titre, date, heure, type, lieu, participants } = body
  if (!titre || !date || !heure || !type) return badRequest('titre, date, heure, type requis')

  const tenue = await prisma.grandLogeTenue.create({
    data: {
      titre, heure, type,
      date: new Date(date),
      lieu: lieu ?? null,
      compteRendu: body.compteRendu ?? null,
      participants: participants ?? [],
      obedienceId: user.obedienceId,
    },
  })
  return created(tenue)
}

async function updateGrandeLogeTenue(id, event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const tenue = await prisma.grandLogeTenue.findUnique({ where: { id } })
  if (!tenue) return notFound('Tenue introuvable')
  requireSameObedience(user, tenue.obedienceId)

  const data = {}
  const fields = ['titre', 'heure', 'type', 'lieu', 'compteRendu', 'participants']
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f]
  }
  if (body.date) data.date = new Date(body.date)

  return ok(await prisma.grandLogeTenue.update({ where: { id }, data }))
}

async function deleteGrandeLogeTenue(id, user) {
  requireRole(user, 'Grand Maître')
  const tenue = await prisma.grandLogeTenue.findUnique({ where: { id } })
  if (!tenue) return notFound('Tenue introuvable')
  requireSameObedience(user, tenue.obedienceId)
  await prisma.grandLogeTenue.delete({ where: { id } })
  return noContent()
}

// ─── CONVOCATIONS GRANDS OFFICIERS ────────────────────────────────────────────

async function listConvocations(event, user) {
  requireRole(user, 'Grand Secrétaire')
  const q = event.queryStringParameters ?? {}
  const where = { obedienceId: user.obedienceId }
  if (q.statut) where.statut = q.statut

  return ok(await prisma.convocationGO.findMany({ where, orderBy: { date: 'desc' } }))
}

async function createConvocation(event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { date, heure, lieu, ordreJour } = body
  if (!date || !heure) return badRequest('date et heure requis')

  const conv = await prisma.convocationGO.create({
    data: {
      date: new Date(date), heure,
      lieu: lieu ?? null,
      ordreJour: ordreJour ?? null,
      statut: body.statut ?? 'Planifié',
      obedienceId: user.obedienceId,
    },
  })
  return created(conv)
}

async function updateConvocation(id, event, user) {
  requireRole(user, 'Grand Secrétaire')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const conv = await prisma.convocationGO.findUnique({ where: { id } })
  if (!conv) return notFound('Convocation introuvable')
  requireSameObedience(user, conv.obedienceId)

  const data = {}
  const fields = ['heure', 'lieu', 'ordreJour', 'statut', 'cr']
  for (const f of fields) { if (body[f] !== undefined) data[f] = body[f] }
  if (body.date) data.date = new Date(body.date)

  return ok(await prisma.convocationGO.update({ where: { id }, data }))
}

async function deleteConvocation(id, user) {
  requireRole(user, 'Grand Maître')
  const conv = await prisma.convocationGO.findUnique({ where: { id } })
  if (!conv) return notFound('Convocation introuvable')
  requireSameObedience(user, conv.obedienceId)
  await prisma.convocationGO.delete({ where: { id } })
  return noContent()
}

