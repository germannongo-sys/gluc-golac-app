const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

export const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: { ...CORS, ...extraHeaders },
  body: JSON.stringify(body),
})

export const ok = (body) => json(200, body)
export const created = (body) => json(201, body)
export const noContent = () => ({ statusCode: 204, headers: CORS, body: '' })

export const badRequest = (msg = 'Requête invalide') => json(400, { error: msg })
export const unauthorized = (msg = 'Non authentifié') => json(401, { error: msg })
export const forbidden = (msg = 'Accès refusé') => json(403, { error: msg })
export const notFound = (msg = 'Ressource introuvable') => json(404, { error: msg })
export const conflict = (msg = 'Conflit de données') => json(409, { error: msg })

export const serverError = (err) => {
  console.error(err)
  return json(500, { error: 'Erreur serveur interne' })
}

export const preflight = () => ({ statusCode: 204, headers: CORS, body: '' })

export const parseBody = (event) => {
  try {
    return event.body ? JSON.parse(event.body) : {}
  } catch {
    return null
  }
}
