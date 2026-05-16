import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/db.mjs'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.mjs'
import {
  ok, badRequest, unauthorized, serverError, preflight, parseBody,
} from '../../lib/response.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  const path = event.path.replace(/.*\/auth\/?/, '')

  try {
    if (event.httpMethod === 'POST' && path === 'login') return login(event)
    if (event.httpMethod === 'POST' && path === 'refresh') return refresh(event)
    if (event.httpMethod === 'POST' && path === 'logout') return logout()

    return badRequest('Route inconnue')
  } catch (err) {
    return serverError(err)
  }
}

// POST /api/auth/login
async function login(event) {
  const body = parseBody(event)
  if (!body) return badRequest('Corps JSON invalide')

  const { matricule, password } = body
  if (!matricule || !password) return badRequest('matricule et password requis')

  const membre = await prisma.membre.findUnique({ where: { matricule } })
  if (!membre || membre.statut === 'radié') return unauthorized('Identifiants invalides')

  const valid = await bcrypt.compare(password, membre.passwordHash)
  if (!valid) return unauthorized('Identifiants invalides')

  const tokenPayload = {
    sub: membre.id,
    matricule: membre.matricule,
    nom: membre.nom,
    role: membre.role,
    grade: membre.grade,
    logeId: membre.logeId,
    obedienceId: membre.obedienceId,
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken({ sub: membre.id }),
  ])

  // Enregistrer la connexion
  await prisma.connexionLog.create({
    data: {
      membreId: membre.id,
      role: membre.role,
      grade: membre.grade,
      ipAddr: event.headers?.['x-forwarded-for'] ?? null,
    },
  })

  return ok({ accessToken, refreshToken, user: tokenPayload })
}

// POST /api/auth/refresh
async function refresh(event) {
  const body = parseBody(event)
  if (!body?.refreshToken) return badRequest('refreshToken requis')

  let payload
  try {
    payload = await verifyRefreshToken(body.refreshToken)
  } catch {
    return unauthorized('Refresh token invalide ou expiré')
  }

  const membre = await prisma.membre.findUnique({ where: { id: payload.sub } })
  if (!membre || membre.statut === 'radié') return unauthorized('Compte invalide')

  const tokenPayload = {
    sub: membre.id,
    matricule: membre.matricule,
    nom: membre.nom,
    role: membre.role,
    grade: membre.grade,
    logeId: membre.logeId,
    obedienceId: membre.obedienceId,
  }

  const accessToken = await signAccessToken(tokenPayload)
  return ok({ accessToken })
}

// POST /api/auth/logout
function logout() {
  // Le frontend supprime les tokens côté client
  return ok({ ok: true })
}
