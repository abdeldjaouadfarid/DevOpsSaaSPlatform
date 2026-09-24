// Global exception filter that turns Prisma's known error codes into
// well-shaped HTTP responses. Without it, a duplicate-email insert would
// surface as a 500 with a P2002 code buried in the message; here we
// translate it to a proper 409 Conflict the client can act on.
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  /**
   * Called by Nest whenever a Prisma known-error escapes a handler.
   * Maps a small allowlist of codes we care about; anything else logs a
   * stack trace and falls through to a generic 500 so the leak is
   * one-way (server logs) instead of two-way (server logs + client body).
   */
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      // P2002 = unique constraint violation (e.g., duplicate email or
      // duplicate (ownerId, name) on Project).
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        message = `Unique constraint violation on ${target}`;
        break;
      }
      // P2025 = row not found for an update/delete that expected one.
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      // Everything else stays a 500 but is logged so we can investigate.
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
    }

    response.status(status).json({ statusCode: status, message });
  }
}
