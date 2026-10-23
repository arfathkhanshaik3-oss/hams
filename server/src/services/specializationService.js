import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';

const dto = (s) => ({ id: s.id, name: s.name, description: s.description, doctorCount: s._count?.doctors ?? 0 });

export async function listSpecializations() {
  const rows = await prisma.specialization.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { doctors: true } } } });
  return rows.map(dto);
}

export async function createSpecialization(data) {
  const exists = await prisma.specialization.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' } } });
  if (exists) throw new AppError(409, 'DUPLICATE', 'A specialization with this name already exists.', { name: 'Already exists' });
  return dto(await prisma.specialization.create({ data }));
}

export async function updateSpecialization(id, data) {
  if (data.name) {
    const clash = await prisma.specialization.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' }, NOT: { id } } });
    if (clash) throw new AppError(409, 'DUPLICATE', 'A specialization with this name already exists.', { name: 'Already exists' });
  }
  const row = await prisma.specialization.update({ where: { id }, data, include: { _count: { select: { doctors: true } } } });
  return dto(row);
}

export async function deleteSpecialization(id) {
  const count = await prisma.doctorProfile.count({ where: { specializationId: id } });
  if (count > 0) throw new AppError(409, 'IN_USE', `Cannot delete: ${count} doctor(s) use this specialization. Reassign them first.`);
  await prisma.specialization.delete({ where: { id } });
}
