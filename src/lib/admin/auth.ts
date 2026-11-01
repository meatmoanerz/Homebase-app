import bcrypt from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'
import { cookies } from 'next/headers'

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
// No fallback: a known default secret would let anyone forge an admin session.
// Without ADMIN_JWT_SECRET admin login is simply disabled.
const JWT_SECRET = process.env.ADMIN_JWT_SECRET

const COOKIE_NAME = 'admin_session'
const TOKEN_EXPIRY = '24h'

export interface AdminPayload {
  username: string
  role: 'admin'
  iat: number
  exp: number
}

export async function validateCredentials(username: string, password: string): Promise<boolean> {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    console.error('Admin credentials not configured in environment variables')
    return false
  }

  if (username !== ADMIN_USERNAME) {
    return false
  }

  return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)
}

export function generateToken(username: string): string {
  if (!JWT_SECRET) throw new Error('ADMIN_JWT_SECRET is not set')
  return sign(
    { username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function verifyToken(token: string): AdminPayload | null {
  if (!JWT_SECRET) return null
  try {
    return verify(token, JWT_SECRET) as AdminPayload
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

export async function setAdminSession(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin')
}

export function isAdminLoginRoute(pathname: string): boolean {
  return pathname === '/admin/login'
}
