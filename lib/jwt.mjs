import { SignJWT, jwtVerify } from 'jose'

const getSecret = (key) => new TextEncoder().encode(process.env[key])

export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '15m')
    .sign(getSecret('JWT_SECRET'))
}

export async function signRefreshToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d')
    .sign(getSecret('JWT_REFRESH_SECRET'))
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getSecret('JWT_SECRET'))
  return payload
}

export async function verifyRefreshToken(token) {
  const { payload } = await jwtVerify(token, getSecret('JWT_REFRESH_SECRET'))
  return payload
}
