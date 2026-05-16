import { verifyAccessToken } from './jwt.mjs'
import { unauthorized, forbidden } from './response.mjs'

// Rôles par niveau d'autorité (croissant)
const ROLE_LEVEL = {
  'Frère': 1,
  'Officier': 2,
  'VM': 3,
  'Grand Secrétaire': 4,
  'Grand Maître': 5,
  'Super Admin': 6,
}

export const requireAuth = async (event) => {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw { status: 401, message: 'Token manquant' }
  }
  const token = authHeader.slice(7)
  try {
    return await verifyAccessToken(token)
  } catch {
    throw { status: 401, message: 'Token invalide ou expiré' }
  }
}

export const requireRole = (user, minRole) => {
  const userLevel = ROLE_LEVEL[user.role] ?? 0
  const minLevel = ROLE_LEVEL[minRole] ?? 99
  if (userLevel < minLevel) {
    throw { status: 403, message: 'Droits insuffisants' }
  }
}

export const requireSameLoge = (user, logeId) => {
  if (
    user.role !== 'Grand Maître' &&
    user.role !== 'Grand Secrétaire' &&
    user.role !== 'Super Admin' &&
    user.logeId !== logeId
  ) {
    throw { status: 403, message: 'Accès limité à votre loge' }
  }
}

export const requireSameObedience = (user, obedienceId) => {
  if (user.role !== 'Super Admin' && user.obedienceId !== obedienceId) {
    throw { status: 403, message: 'Accès limité à votre obédience' }
  }
}

export const handleAuthError = (err) => {
  if (err?.status === 401) return unauthorized(err.message)
  if (err?.status === 403) return forbidden(err.message)
  return null
}
