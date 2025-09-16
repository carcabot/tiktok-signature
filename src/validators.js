export class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

export const validators = {
  isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL must be a non-empty string');
    }

    try {
      const parsed = new URL(url);

      if (!parsed.protocol || !['http:', 'https:'].includes(parsed.protocol)) {
        throw new ValidationError('URL must use HTTP or HTTPS protocol');
      }

      if (!parsed.hostname.includes('tiktok.com')) {
        throw new ValidationError('URL must be a TikTok domain');
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid URL format');
    }
  },

  isValidUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      throw new ValidationError('User agent must be a non-empty string');
    }

    if (userAgent.length < 10 || userAgent.length > 500) {
      throw new ValidationError('User agent length must be between 10 and 500 characters');
    }

    return true;
  },

  isValidPort(port) {
    const portNum = parseInt(port, 10);

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new ValidationError('Port must be a number between 1 and 65535');
    }

    return true;
  },

  sanitizeUrl(url) {
    if (!url) return url;

    url = url.trim();

    if (url.length > 2048) {
      throw new ValidationError('URL is too long (max 2048 characters)');
    }

    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(url)) {
        throw new ValidationError('URL contains potentially dangerous content');
      }
    }

    return url;
  },

  validateSignatureResponse(data) {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid signature response format');
    }

    const requiredFields = ['signature', 'verify_fp', 'signed_url', 'x-tt-params', 'x-bogus'];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    if (!data.signature.startsWith('_')) {
      throw new ValidationError('Invalid signature format');
    }

    if (!data.verify_fp.startsWith('verify_')) {
      throw new ValidationError('Invalid verify_fp format');
    }

    return true;
  },
};