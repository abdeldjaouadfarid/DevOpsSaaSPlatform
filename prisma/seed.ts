// Prisma seed script — creates a demo user, project, and completed
// deployment so a fresh dev DB isn't empty.
//
// Run with:  pnpm prisma:generate && pnpm ts-node prisma/seed.ts
// (or hook it into package.json's "prisma": { "seed": "..." } later.)
import { PrismaClient, DeploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Idempotent seed: uses `upsert` so re-running never duplicates rows or
 * hits unique-constraint errors. Safe to run repeatedly on the same DB.
 */
async function main() {
  const email = 'demo@example.com';
  // Same cost as production (BCRYPT_ROUNDS in auth.service.ts).
  const passwordHash = await bcrypt.hash('demo-password-1234', 12);

  // Demo user — password is 'demo-password-1234'. Kept obvious so a
  // new developer can sign in without hunting.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: 'Demo',
      lastName: 'User',
      passwordHash,
    },
  });

  // One demo project owned by the demo user. The composite unique
  // (ownerId, name) is what `where` targets on upsert.
  const project = await prisma.project.upsert({
    where: { ownerId_name: { ownerId: user.id, name: 'demo-api' } },
    update: {},
    create: {
      name: 'demo-api',
      repoUrl: 'https://github.com/example/demo-api',
      ownerId: user.id,
    },
  });

  // One historical successful deployment so the /projects/:id detail
  // view has something to show.
  await prisma.deployment.create({
    data: {
      projectId: project.id,
      commitSha: 'deadbeef',
      status: DeploymentStatus.SUCCESS,
      logs: 'Seeded successful deployment.',
      finishedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded demo user (${email}) with project ${project.name}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    // Always release the connection pool so the process can exit
    // cleanly whether we succeeded or failed.
    await prisma.$disconnect();
  });
