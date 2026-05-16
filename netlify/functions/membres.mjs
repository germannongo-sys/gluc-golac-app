import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameLoge, requireSameObedience, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, badRequest, notFound, conflict, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  // Extraire l'ID depuis le path : /api/membres ou /api/membres/:id
  const parts = event.path.replace(/.*\/membres\/?/, '').split('/').filter(Boolean)
  const id = parts[0] ?? null

  try {
    const user = await requireAuth(event)

    if (event.httpMethod === 'GET' && !id) return await listMembres(event, user)
    if (event.httpMethod === 'GET' && id) return await getMembre(id, user)
    if (event.httpMethod === 'POST') return await createMembre(event, user)
    if (event.httpMethod === 'PATCH' && id) return await updateMembre(id, event, user)
    if (event.httpMethod === 'DELETE' && id) return await radierMembre(id, user)

    return badRequest('Méthode non supportée')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// GET /api/membres
async function listMembres(event, user) {
  const q = event.queryStringParameters ?? {}

  const where = { obedienceId: user.obedienceId }

  // Frères et officiers ne voient que leur loge
  if (['Frère', 'Officier'].includes(user.role)) {
    where.logeId = user.logeId
  } else if (q.logeId) {
    where.logeId = q.logeId
  }

  if (q.grade) where.grade = q.grade
  if (q.statut) where.statut = q.statut
  if (q.search) {
    where.OR = [
      { nom: { contains: q.search, mode: 'insensitive' } },
      { matricule: { contains: q.search, mode: 'insensitive' } },
    ]
  }

  const membres = await prisma.membre.findMany({
    where,
    select: {
      id: true, matricule: true, nom: true, grade: true, role: true,
      statut: true, tel: true, email: true, logeId: true, secondLogeId: true,
      dateGrade: true, dateInit: true, dateAugm: true, dateExalt: true,
      createdAt: true,
    },
    orderBy: { nom: 'asc' },
  })

  return ok(membres)
}

// GET /api/membres/:id
async function getMembre(id, user) {
  const membre = await prisma.membre.findUnique({
    where: { id },
    select: {
      id: true, matricule: true, nom: true, grade: true, role: true,
      statut: true, tel: true, email: true, logeId: true, secondLogeId: true,
      dateGrade: true, dateInit: true, dateAugm: true, dateExalt: true,
      affiliJson: true, obedienceId: true, createdAt: true,
    },
  })

  if (!membre) return notFound('Membre introuvable')

  // Un frère ne peut voir que son propre profil ou ceux de sa loge (VM/officier)
  if (user.role === 'Frère' && membre.id !== user.sub) {
    return notFound('Membre introuvable')
  }

  requireSameObedience(user, membre.obedienceId)
  return ok(membre)
}

// POST /api/membres
async function createMembre(event, user) {
  requireRole(user, 'VM')

  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { matricule, nom, grade, password, logeId, role, ...rest } = body

  if (!matricule || !nom || !password) {
    return badRequest('matricule, nom et password requis')
  }

  const existing = await prisma.membre.findUnique({ where: { matricule } })
  if (existing) return conflict(`Matricule ${matricule} déjà utilisé`)

  const logeIdTarget = logeId ?? user.logeId
  requireSameLoge(user, logeIdTarget)

  const passwordHash = await bcrypt.hash(password, 12)

  const membre = await prisma.membre.create({
    data: {
      matricule,
      nom,
      grade: grade ?? 'Apprenti',
      role: role ?? 'Frère',
      passwordHash,
      logeId: logeIdTarget,
      obedienceId: user.obedienceId,
      dateGrade: rest.dateGrade ? new Date(rest.dateGrade) : null,
      dateInit: rest.dateInit ? new Date(rest.dateInit) : null,
      dateAugm: rest.dateAugm ? new Date(rest.dateAugm) : null,
      dateExalt: rest.dateExalt ? new Date(rest.dateExalt) : null,
      tel: rest.tel ?? null,
      email: rest.email ?? null,
      statut: rest.statut ?? 'actif',
    },
    select: {
      id: true, matricule: true, nom: true, grade: true, role: true,
      statut: true, logeId: true, obedienceId: true, createdAt: true,
    },
  })

  return created(membre)
}

// PATCH /api/membres/:id
async function updateMembre(id, event, user) {
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const membre = await prisma.membre.findUnique({ where: { id } })
  if (!membre) return notFound('Membre introuvable')

  requireSameObedience(user, membre.obedienceId)

  const safeSelect = {
    id: true, matricule: true, nom: true, grade: true, role: true,
    statut: true, tel: true, email: true, logeId: true, secondLogeId: true,
    dateGrade: true, dateInit: true, dateAugm: true, dateExalt: true,
    affiliJson: true, obedienceId: true, updatedAt: true,
  }

  // Un frère ne peut modifier que son propre profil (champs limités)
  if (user.role === 'Frère') {
    if (membre.id !== user.sub) return notFound('Membre introuvable')
    const { tel, email, password } = body
    const data = {}
    if (tel !== undefined) data.tel = tel
    if (email !== undefined) data.email = email
    if (password) data.passwordHash = await bcrypt.hash(password, 12)
    const updated = await prisma.membre.update({ where: { id }, data, select: safeSelect })
    return ok(updated)
  }

  requireSameLoge(user, membre.logeId)

  const data = {}
  const fields = ['nom', 'grade', 'role', 'statut', 'tel', 'email', 'logeId', 'secondLogeId', 'affiliJson']
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f]
  }
  const dateFields = ['dateGrade', 'dateInit', 'dateAugm', 'dateExalt']
  for (const f of dateFields) {
    if (body[f] !== undefined) data[f] = body[f] ? new Date(body[f]) : null
  }
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)

  const updated = await prisma.membre.update({ where: { id }, data, select: safeSelect })
  return ok(updated)
}

// DELETE /api/membres/:id → radiation (soft delete)
async function radierMembre(id, user) {
  requireRole(user, 'Grand Secrétaire')

  const membre = await prisma.membre.findUnique({ where: { id } })
  if (!membre) return notFound('Membre introuvable')
  requireSameObedience(user, membre.obedienceId)

  await prisma.membre.update({ where: { id }, data: { statut: 'radié' } })
  return ok({ ok: true, id })
}
