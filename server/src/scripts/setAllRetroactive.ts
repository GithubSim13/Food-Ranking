import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../generated/prisma/client";
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.review.updateMany({
    data: { retroactive: true },
  });
  console.log(`Updated ${result.count} review(s) → retroactive = true`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
