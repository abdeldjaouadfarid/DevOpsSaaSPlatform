import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers';

async function registerUser(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password12' })
    .expect(201);
  return res.body.accessToken as string;
}

describe('Projects (e2e)', () => {
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

  it('supports CRUD for the authenticated user', async () => {
    const token = await registerUser(app, 'crud@example.com');

    const createRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'demo-api', repoUrl: 'https://github.com/user/demo' })
      .expect(201);

    const projectId = createRes.body.id as string;
    expect(createRes.body.name).toBe('demo-api');

    await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(1));

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'demo-api-2' })
      .expect(200)
      .expect((res) => expect(res.body.name).toBe('demo-api-2'));

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('does not leak another user\'s projects', async () => {
    const aliceToken = await registerUser(app, 'alice-iso@example.com');
    const bobToken = await registerUser(app, 'bob-iso@example.com');

    const created = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'alice-app', repoUrl: 'https://github.com/alice/app' })
      .expect(201);

    const projectId = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'stolen' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('rejects invalid input with 400', async () => {
    const token = await registerUser(app, 'val@example.com');
    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'BAD NAME', repoUrl: 'https://gitlab.com/x/y' })
      .expect(400);
  });

  it('conflicts on duplicate (owner, name)', async () => {
    const token = await registerUser(app, 'dup@example.com');
    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'unique', repoUrl: 'https://github.com/x/y' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'unique', repoUrl: 'https://github.com/x/z' })
      .expect(409);
  });
});
