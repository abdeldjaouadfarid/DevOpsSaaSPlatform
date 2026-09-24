import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaClient>;
  let jwt: { sign: jest.Mock };

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  });

  describe('register', () => {
    it('hashes the password, creates the user, and returns a token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'Jawad',
        lastName: 'Farid',
        createdAt: new Date('2026-01-01'),
      } as never);

      const result = await service.register({
        email: 'a@b.com',
        password: 'password12',
        firstName: 'Jawad',
        lastName: 'Farid',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.user.create.mock.calls[0][0] as {
        data: { passwordHash: string; firstName: string; lastName: string };
      };
      expect(createArgs.data.passwordHash).not.toBe('password12');
      expect(await bcrypt.compare('password12', createArgs.data.passwordHash)).toBe(true);
      expect(createArgs.data.firstName).toBe('Jawad');
      expect(createArgs.data.lastName).toBe('Farid');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('rejects duplicate emails with ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'x' } as never);
      await expect(
        service.register({
          email: 'a@b.com',
          password: 'password12',
          firstName: 'Jawad',
          lastName: 'Farid',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password12', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'Jawad',
        lastName: 'Farid',
        passwordHash,
        createdAt: new Date('2026-01-01'),
      } as never);

      const result = await service.login('a@b.com', 'password12');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.firstName).toBe('Jawad');
    });

    it('rejects unknown email with generic UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nope@b.com', 'password12')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects wrong password with the same generic message as unknown email', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      let unknownEmailMessage: string | undefined;
      let wrongPasswordMessage: string | undefined;

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await service.login('nope@b.com', 'x').catch((e: UnauthorizedException) => {
        unknownEmailMessage = e.message;
      });

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'Jawad',
        lastName: 'Farid',
        passwordHash,
      } as never);
      await service.login('a@b.com', 'wrong-password').catch((e: UnauthorizedException) => {
        wrongPasswordMessage = e.message;
      });

      expect(unknownEmailMessage).toBeDefined();
      expect(unknownEmailMessage).toBe(wrongPasswordMessage);
    });
  });
});
