import { PrismaClient, DeploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@example.com';
  const passwordHash = await bcrypt.hash('demo-password-1234', 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash },
  });

  const project = await prisma.project.upsert({
    where: { ownerId_name: { ownerId: user.id, name: 'demo-api' } },
    update: {},
    create: {
      name: 'demo-api',
      repoUrl: 'https://github.com/example/demo-api',
      ownerId: user.id,
    },
  });

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
    await prisma.$disconnect();
  });
