import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { dateKey } from '../utils/time.js';
import { publicUser } from './authService.js';

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patientProfile: true, doctorProfile: { include: { specialization: true } } },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  const out = { ...publicUser(user) };
  if (user.patientProfile) {
    const p = user.patientProfile;
    out.patient = {
      id: p.id,
      dateOfBirth: p.dateOfBirth ? dateKey(p.dateOfBirth) : null,
      gender: p.gender,
      address: p.address,
      emergencyContact: p.emergencyContact,
    };
  }
  if (user.doctorProfile) {
    const d = user.doctorProfile;
    out.doctor = {
      id: d.id,
      specialization: d.specialization.name,
      consultationFee: Number(d.consultationFee),
      experienceYears: d.experienceYears,
      qualification: d.qualification,
      bio: d.bio,
      room: d.room,
    };
  }
  return out;
}

export async function updateProfile(user, data) {
  await prisma.$transaction(async (tx) => {
    const userData = {};
    if (data.fullName !== undefined) userData.fullName = data.fullName;
    if (data.phone !== undefined) userData.phone = data.phone;
    if (Object.keys(userData).length) await tx.user.update({ where: { id: user.id }, data: userData });

    if (user.role === 'PATIENT') {
      const p = {};
      if (data.dateOfBirth !== undefined) p.dateOfBirth = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
      if (data.gender !== undefined) p.gender = data.gender;
      if (data.address !== undefined) p.address = data.address;
      if (data.emergencyContact !== undefined) p.emergencyContact = data.emergencyContact;
      if (Object.keys(p).length) await tx.patientProfile.update({ where: { userId: user.id }, data: p });
    }
    if (user.role === 'DOCTOR') {
      const d = {};
      if (data.bio !== undefined) d.bio = data.bio;
      if (data.qualification !== undefined) d.qualification = data.qualification;
      if (Object.keys(d).length) await tx.doctorProfile.update({ where: { userId: user.id }, data: d });
    }
  });
  return getProfile(user.id);
}
