import { z } from 'zod';
import { ValidationError } from './errors.js';

export class Validator {
  static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    errorMessage?: string
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }));
        throw new ValidationError(
          errorMessage || 'Validation failed',
          { errors: details }
        );
      }
      throw error;
    }
  }

  static validatePartial<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    errorMessage?: string
  ): Partial<T> {
    try {
      return schema.partial().parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }));
        throw new ValidationError(
          errorMessage || 'Validation failed',
          { errors: details }
        );
      }
      throw error;
    }
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidAlias(alias: string): boolean {
    const aliasRegex = /^[a-zA-Z0-9-_]+$/;
    return alias.length > 0 && alias.length <= 50 && aliasRegex.test(alias);
  }

  static isValidHostname(hostname: string): boolean {
    const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
    return hostname.length > 0 && hostname.length <= 255 && hostnameRegex.test(hostname);
  }

  static isValidPath(path: string): boolean {
    try {
      return path.length > 0 && !path.includes('\0');
    } catch {
      return false;
    }
  }

  static sanitizeAlias(alias: string): string {
    return alias.toLowerCase().replace(/[^a-z0-9-_]/g, '-').substring(0, 50);
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }
}