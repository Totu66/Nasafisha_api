import { Injectable, Logger } from '@nestjs/common';
import { ApiError, ERROR_CODES } from '../common/errors';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(to: string, message: string): Promise<void> {
    const apiKey = process.env.SMS_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new ApiError(ERROR_CODES.SMS_FAILED, 'SMS is not set up.', 502);
      }
      this.logger.warn(`[DEV SMS to ${to}] ${message}`);
      return;
    }

    const url =
      process.env.SMS_URL ??
      'https://api.africastalking.com/version1/messaging';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username: process.env.SMS_USERNAME ?? 'sandbox',
            to,
            message,
          }),
          signal: AbortSignal.timeout(7000),
        });

        if (response.ok) return;
        this.logger.warn(`SMS gateway returned HTTP ${response.status}.`);
      } catch (error) {
        this.logger.warn(
          `SMS attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** attempt * 500),
        );
      }
    }

    throw new ApiError(
      ERROR_CODES.SMS_FAILED,
      'Could not send the SMS. Try again.',
      502,
    );
  }
}
