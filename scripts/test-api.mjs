const BASE = 'http://localhost:8889'

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const ok  = (label, r) => console.log(`  ✓ [${r.status}] ${label}`)
const err = (label, r) => console.log(`  ✗ [${r.status}] ${label} →`, JSON.stringify(r.data))

console.log('\n=== Test suite API GLUC/GOLAC ===\n')

// ── 1. Login ──────────────────────────────────────────────────────────────────
console.log('[1] Auth')
const login = await req('POST', '/api/auth/login', { matricule: 'GLUC-00', password: 'admin2026' })
login.status === 200 ? ok('Login Grand Maître', login) : err('Login Grand Maître', login)
const TOKEN = login.data.accessToken
console.log('    JWT sub:', login.data.user?.sub)
console.log('    Rôle   :', login.data.user?.role)

const loginBad = await req('POST', '/api/auth/login', { matricule: 'GLUC-00', password: 'mauvais' })
loginBad.status === 401 ? ok('Mauvais mot de passe rejeté (401)', loginBad) : err('Mauvais mot de passe', loginBad)

const refresh = await req('POST', '/api/auth/refresh', { refreshToken: login.data.refreshToken })
refresh.status === 200 ? ok('Refresh token', refresh) : err('Refresh token', refresh)

// ── 2. Obédience ──────────────────────────────────────────────────────────────
console.log('\n[2] Obédience')
const ob = await req('GET', '/api/obedience', null, TOKEN)
ob.status === 200 ? ok(`Obédience: ${ob.data.acronyme} — ${ob.data.nom}`, ob) : err('GET obédience', ob)
console.log('    Grands Officiers:', ob.data.grandOfficiers?.length)

// ── 3. Loges ──────────────────────────────────────────────────────────────────
console.log('\n[3] Loges')
const loges = await req('GET', '/api/loges', null, TOKEN)
loges.status === 200 ? ok(`${loges.data.length} loges reçues`, loges) : err('GET loges', loges)
loges.data.forEach?.(l => console.log(`    • L${l.numero} ${l.nom} (${l.ville}) — ${l._count?.membres} membres`))

// ── 4. Membres ────────────────────────────────────────────────────────────────
console.log('\n[4] Membres')
const membres = await req('GET', '/api/membres', null, TOKEN)
membres.status === 200 ? ok(`${membres.data.length} membres reçus`, membres) : err('GET membres', membres)
membres.data.slice(0, 4).forEach?.(m => console.log(`    • ${m.matricule} ${m.nom} [${m.grade}]`))

const noHash = membres.data.every(m => !m.passwordHash)
noHash ? ok('passwordHash absent des réponses', { status: 200 }) : err('SÉCURITÉ: passwordHash exposé !', { status: 500 })

// ── 5. Agenda ─────────────────────────────────────────────────────────────────
console.log('\n[5] Agenda')
const logeId = loges.data[0]?.id
const agenda = await req('GET', `/api/agenda?logeId=${logeId}`, null, TOKEN)
agenda.status === 200 ? ok(`${agenda.data.length} tenues pour loge 001`, agenda) : err('GET agenda', agenda)

// ── 6. Finances ───────────────────────────────────────────────────────────────
console.log('\n[6] Finances')
const caps = await req('GET', `/api/finances/capitations?logeId=${logeId}`, null, TOKEN)
caps.status === 200 ? ok(`${caps.data.length} capitations`, caps) : err('GET capitations', caps)

const tronc = await req('GET', `/api/finances/tronc?logeId=${logeId}`, null, TOKEN)
tronc.status === 200 ? ok(`Tronc de la veuve — solde: ${tronc.data.solde} FCFA`, tronc) : err('GET tronc', tronc)

// ── 7. Documents ──────────────────────────────────────────────────────────────
console.log('\n[7] Documents')
const docs = await req('GET', '/api/documents', null, TOKEN)
docs.status === 200 ? ok(`${docs.data.length} document(s)`, docs) : err('GET documents', docs)

// ── 8. Contrôle d'accès ───────────────────────────────────────────────────────
console.log('\n[8] Contrôle d\'accès')
const noAuth = await req('GET', '/api/membres')
noAuth.status === 401 ? ok('Sans token → 401 refusé', noAuth) : err('Accès sans token non bloqué !', noAuth)

const loginFrère = await req('POST', '/api/auth/login', { matricule: 'F-003', password: '1234' })
const tokenFrère = loginFrère.data.accessToken
const autreLoge = await req('GET', `/api/loges/${loges.data[1]?.id}`, null, tokenFrère)
autreLoge.status === 403 ? ok('Frère bloqué sur autre loge (403)', autreLoge) : err('Frère peut voir autre loge', autreLoge)

console.log('\n=== Fin des tests ===\n')
