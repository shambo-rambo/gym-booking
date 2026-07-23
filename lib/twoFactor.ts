import crypto from "crypto"
import { authenticator } from "otplib"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY
  if (!key) throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not set")
  const buf = Buffer.from(key, "base64")
  if (buf.length !== 32) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY must decode to 32 bytes")
  }
  return buf
}

// Stored as "iv:tag:ciphertext" (all base64) so decryption doesn't need a separate column.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":")
}

export function decryptSecret(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(":")
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret()
}

export function totpUri(secret: string, email: string): string {
  return authenticator.keyuri(email, "The Watertower", secret)
}

export function verifyTotp(secret: string, token: string): boolean {
  // Allow +/- 1 step (30s) of clock drift between the server and the user's device.
  authenticator.options = { window: 1 }
  try {
    return authenticator.check(token, secret)
  } catch {
    return false
  }
}

// Backup codes are already high-entropy random (not user-chosen), so a deterministic
// HMAC is used instead of a slow password hash — verify-login can then do one indexed
// lookup instead of looping a bcrypt compare across up to 10 rows.
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase() // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function hashBackupCode(code: string): string {
  return crypto.createHmac("sha256", getKey()).update(normalizeBackupCode(code)).digest("hex")
}

export function generateTrustedDeviceToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function hashTrustedDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export const TRUSTED_DEVICE_COOKIE = "td_token"
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // fixed 30 days, no sliding renewal

export const TWO_FACTOR_MAX_ATTEMPTS = 5
export const TWO_FACTOR_LOCKOUT_MS = 15 * 60 * 1000
