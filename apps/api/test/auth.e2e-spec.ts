import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers';

const registerPayload = (email: string) => ({
  email,
  password: 'password12',
  firstName: 'Jane',
  lastName: 'Doe',
});

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, and returns the current user', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerPayload('alice@example.com'))
      .expect(201);

    expect(registerRes.body.accessToken).toEqual(expect.any(String));
    expect(registerRes.body.user.email).toBe('alice@example.com');
    expect(registerRes.body.user.firstName).toBe('Jane');
    expect(registerRes.body.user.lastName).toBe('Doe');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password12' })
      .expect(200);

    const token = loginRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.email).toBe('alice@example.com');
    expect(meRes.body.firstName).toBe('Jane');
    expect(meRes.body.lastName).toBe('Doe');
  });

  it('rejects duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerPayload('dup@example.com'))
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerPayload('dup@example.com'))
      .expect(409);
  });

  it('rejects wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerPayload('bob@example.com'))
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'wrong-one' })
      .expect(401);
  });

  it('rejects registration missing firstName/lastName with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'x@example.com', password: 'password12' })
      .expect(400);
  });

  it('protects /users/me without a JWT', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
