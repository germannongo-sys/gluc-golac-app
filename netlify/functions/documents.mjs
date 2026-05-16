import { prisma } from '../../lib/db.mjs'
import { requireAuth, requireRole, requireSameObedience, handleAuthError } from '../../lib/middleware.mjs'
import {
  ok, created, noContent, badRequest, notFound, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

const GRADE_LEVEL = { Tous: 0, Apprenti: 1, Compagnon: 2, Maitre: 3 }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  const parts = event.path.replace(/.*\/documents\/?/, '').split('/').filter(Boolean)
  const id = parts[0] ?? null

  try {
    const user = await requireAuth(event)

    if (event.httpMethod === 'GET' && !id) return await listDocuments(event, user)
    if (event.httpMethod === 'GET' && id) return await getDocument(id, user)
    if (event.httpMethod === 'POST') return await createDocument(event, user)
    if (event.httpMethod === 'PATCH' && id) return await updateDocument(id, event, user)
    if (event.httpMethod === 'DELETE' && id) return await deleteDocument(id, user)

    return badRequest('Méthode non supportée')
  } catch (err) {
    return handleAuthError(err) ?? serverError(err)
  }
}

// GET /api/documents?type=&grade=&search=
async function listDocuments(event, user) {
  const q = event.queryStringParameters ?? {}
  const where = { obedienceId: user.obedienceId }

  if (q.type) where.type = q.type

  // Filtrer selon le grade de l'utilisateur : seuls les docs accessibles
  const userGradeLevel = GRADE_LEVEL[user.grade] ?? 0
  if (q.grade) {
    where.grade = q.grade
  } else {
    // Retourner uniquement les docs dont le grade requis ≤ grade de l'utilisateur
    const accessibleGrades = Object.entries(GRADE_LEVEL)
      .filter(([, level]) => level <= userGradeLevel)
      .map(([g]) => g)
    where.grade = { in: accessibleGrades }
  }

  if (q.search) {
    where.OR = [
      { titre: { contains: q.search, mode: 'insensitive' } },
      { contenu: { contains: q.search, mode: 'insensitive' } },
    ]
  }

  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true, titre: true, type: true, grade: true,
      date: true, fileName: true, fileType: true, fileUrl: true,
      createdAt: true,
    },
    orderBy: { date: 'desc' },
  })

  return ok(docs)
}

// GET /api/documents/:id
async function getDocument(id, user) {
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return notFound('Document introuvable')
  requireSameObedience(user, doc.obedienceId)

  // Vérifier accès par grade
  const userGradeLevel = GRADE_LEVEL[user.grade] ?? 0
  const docGradeLevel = GRADE_LEVEL[doc.grade] ?? 0
  if (docGradeLevel > userGradeLevel && user.role !== 'Grand Maître' && user.role !== 'Grand Secrétaire') {
    return notFound('Document introuvable')
  }

  return ok(doc)
}

// POST /api/documents
async function createDocument(event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { titre, type, grade, date, contenu, fileUrl, fileName, fileType } = body
  if (!titre || !type || !date) return badRequest('titre, type, date requis')

  const doc = await prisma.document.create({
    data: {
      titre, type,
      grade: grade ?? 'Tous',
      date: new Date(date),
      contenu: contenu ?? null,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      fileType: fileType ?? null,
      obedienceId: user.obedienceId,
    },
  })
  return created(doc)
}

// PATCH /api/documents/:id
async function updateDocument(id, event, user) {
  requireRole(user, 'VM')
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return notFound('Document introuvable')
  requireSameObedience(user, doc.obedienceId)

  const data = {}
  const fields = ['titre', 'type', 'grade', 'contenu', 'fileUrl', 'fileName', 'fileType']
  for (const f of fields) { if (body[f] !== undefined) data[f] = body[f] }
  if (body.date) data.date = new Date(body.date)

  return ok(await prisma.document.update({ where: { id }, data }))
}

// DELETE /api/documents/:id
async function deleteDocument(id, user) {
  requireRole(user, 'Grand Secrétaire')

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return notFound('Document introuvable')
  requireSameObedience(user, doc.obedienceId)

  await prisma.document.delete({ where: { id } })
  return noContent()
}

