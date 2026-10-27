import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiError, ERROR_CODES } from '../common/errors';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private createAuthClient(): SupabaseClient {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_ANON_KEY') ||
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new ApiError(
        ERROR_CODES.EMAIL_FAILED,
        'Email sign-in is not configured.',
        503,
      );
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
    const { error } = await this.createAuthClient().auth.signInWithOtp({
      email,
    });

    if (error) {
      this.logger.warn(
        `Supabase email OTP request failed (${error.code ?? 'unknown'}).`,
      );
      throw new ApiError(
        ERROR_CODES.EMAIL_FAILED,
        'Could not send the email code. Try again.',
        502,
      );
    }
  }

  async verifyCode(email: string, code: string): Promise<string> {
    const { data, error } = await this.createAuthClient().auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error || !data.user?.email) {
      if (error) {
        this.logger.warn(
          `Supabase email OTP verification failed (${error.code ?? 'unknown'}).`,
        );
      }
      throw new ApiError(
        ERROR_CODES.OTP_INVALID,
        'That code is invalid or has expired. Request a new code.',
        400,
      );
    }

    return data.user.email.toLowerCase();
  }
}
