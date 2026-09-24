import { INestApplication } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers';

const registerPayload = (email: string) => ({
  email,
  password: 'password12',
  firstName: 'Test',
  lastName: 'User',
});

async function registerAndLogin(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send(registerPayload(email))
    .expect(201);
  return res.body.accessToken as string;
}

async function createProject(app: INestApplication, token: string, name: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, repoUrl: `https://github.com/user/${name}` })
    .expect(201);
  return res.body.id as string;
}

describe('Deployments trigger (e2e)', () => {
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

  it('creates a PENDING deployment and returns it', async () => {
    const token = await registerAndLogin(app, 'trig@example.com');
    const projectId = await createProject(app, token, 'demo-app');

    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/deployments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ commitSha: 'abc1234' })
      .expect(201);

    expect(res.body.projectId).toBe(projectId);
    expect(res.body.status).toBe(DeploymentStatus.PENDING);
    expect(res.body.commitSha).toBe('abc1234');
    expect(res.body.finishedAt).toBeNull();
  });

  it('accepts an empty body (commitSha optional)', async () => {
    const token = await registerAndLogin(app, 'nosha@example.com');
    const projectId = await createProject(app, token, 'nosha-app');

    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/deployments`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(res.body.commitSha).toBeNull();
  });

  it("does not let a user trigger on another user's project", async () => {
    const aliceToken = await registerAndLogin(app, 'alice-trig@example.com');
    const bobToken = await registerAndLogin(app, 'bob-trig@example.com');
    const projectId = await createProject(app, aliceToken, 'alice-app');

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/deployments`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({})
      .expect(404);
  });

  it('rejects missing JWT with 401', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${'00000000-0000-0000-0000-000000000000'}/deployments`)
      .send({})
      .expect(401);
  });
});
