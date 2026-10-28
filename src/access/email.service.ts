import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiError, ERROR_CODES } from '../common/errors';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly devCodes = new Map<
    string,
    { code: string; expiresAt: number }
  >();

  constructor(private readonly config: ConfigService) {}

  private createAuthClient(): SupabaseClient | null {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_ANON_KEY') ||
      this.config.get<string>('SUPABASE_PUBLIC_KEY') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      return null;
    }

    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async sendCode(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const client = this.createAuthClient();
      if (client) {
        const { error } = await client.auth.signInWithOtp({
          email: normalizedEmail,
        });

        if (!error) {
          return;
        }

        this.logger.warn(
          `Supabase email OTP request failed (${error.code ?? error.message}). Checking development fallback...`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Supabase client error: ${err.message}. Checking development fallback...`,
      );
    }

    // In development mode, provide a fallback OTP so local testing is never blocked
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    if (isDev) {
      const devCode = '123456';
      this.devCodes.set(normalizedEmail, {
        code: devCode,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });
      this.logger.log(`\n==================================================`);
      this.logger.log(`[DEV OTP] Sign-in code for ${normalizedEmail} is: ${devCode}`);
      this.logger.log(`==================================================\n`);
      return;
    }

    throw new ApiError(
      ERROR_CODES.EMAIL_FAILED,
      'Could not send the email code. Try again.',
      502,
    );
  }

  async verifyCode(email: string, code: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check dev codes first in non-production
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    if (isDev) {
      const devEntry = this.devCodes.get(normalizedEmail);
      if (devEntry && devEntry.expiresAt > Date.now() && devEntry.code === code) {
        this.devCodes.delete(normalizedEmail);
        return normalizedEmail;
      }
      if (code === '123456') {
        return normalizedEmail;
      }
    }

    try {
      const client = this.createAuthClient();
      if (client) {
        const { data, error } = await client.auth.verifyOtp({
          email: normalizedEmail,
          token: code,
          type: 'email',
        });

        if (!error && data.user?.email) {
          return data.user.email.toLowerCase();
        }

        if (error) {
          this.logger.warn(
            `Supabase email OTP verification failed (${error.code ?? error.message}).`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Supabase verification error: ${err.message}`);
    }

    throw new ApiError(
      ERROR_CODES.OTP_INVALID,
      'That code is invalid or has expired. Request a new code.',
      400,
    );
  }
}
