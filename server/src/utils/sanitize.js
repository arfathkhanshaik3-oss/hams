// Trim and strip control characters / angle brackets from free text.
// React escapes output and Prisma parameterises queries, so this is an extra layer.
export const cleanText = (value) =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, '').trim()
    : value;
