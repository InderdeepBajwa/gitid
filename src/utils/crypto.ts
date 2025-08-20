import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { SecurityError } from './errors.js';

export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;
  private static readonly ITERATIONS = 100000;

  static async generateKeyPair(
    type: 'rsa' | 'ed25519' | 'ecdsa',
    passphrase?: string
  ): Promise<{ publicKey: string; privateKey: string }> {
    return new Promise((resolve, reject) => {
      const options: any = {
        modulusLength: type === 'rsa' ? 4096 : undefined,
        namedCurve: type === 'ecdsa' ? 'P-256' : undefined,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: passphrase ? 'aes-256-cbc' : undefined,
          passphrase
        }
      };

      const keyType = type === 'ecdsa' ? 'ec' : type;
      
      crypto.generateKeyPair(keyType as any, options, (err, publicKey, privateKey) => {
        if (err) {
          reject(new SecurityError('Failed to generate key pair', { error: err.message }));
        } else {
          resolve({
            publicKey: publicKey as unknown as string,
            privateKey: privateKey as unknown as string
          });
        }
      });
    });
  }

  static async encryptData(data: string, password: string): Promise<string> {
    try {
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const key = crypto.pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      const combined = Buffer.concat([salt, iv, tag, encrypted]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new SecurityError('Encryption failed', { error });
    }
  }

  static async decryptData(encryptedData: string, password: string): Promise<string> {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      const salt = combined.subarray(0, this.SALT_LENGTH);
      const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = combined.subarray(
        this.SALT_LENGTH + this.IV_LENGTH,
        this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
      );
      const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      
      const key = crypto.pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new SecurityError('Decryption failed', { error });
    }
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(32);
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, this.ITERATIONS, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(new SecurityError('Password hashing failed', { error: err }));
        else resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
      });
    });
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, Buffer.from(salt, 'hex'), this.ITERATIONS, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(new SecurityError('Password verification failed', { error: err }));
        else resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  static generateFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest();
    return hash.toString('base64').replace(/=/g, '').substring(0, 43);
  }

  static async encryptFile(filePath: string, password: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf8');
    const encrypted = await this.encryptData(data, password);
    await fs.writeFile(filePath + '.enc', encrypted);
  }

  static async decryptFile(filePath: string, password: string): Promise<string> {
    const encryptedData = await fs.readFile(filePath, 'utf8');
    return this.decryptData(encryptedData, password);
  }

  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}