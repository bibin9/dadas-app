import { PrismaClient } from "../src/generated/prisma/client.ts";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: { username: "admin", passwordHash },
    });
    console.log("Created default admin user (username: admin, password: admin123)");
  }

  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  if (!settings) {
    await prisma.settings.create({ data: { id: "main" } });
    console.log("Created default settings");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
