import { prisma } from '../config/prisma.js';

// There is exactly one settings row (id = 1). It is created on first use.
export async function getSettings(client = prisma) {
  const found = await client.clinicSettings.findUnique({ where: { id: 1 } });
  if (found) return found;
  try {
    return await client.clinicSettings.create({ data: { id: 1 } });
  } catch (err) {
    if (err?.code === 'P2002') return client.clinicSettings.findUnique({ where: { id: 1 } });
    throw err;
  }
}
