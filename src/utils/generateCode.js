export const generateCode = (service) => {
  const prefix = service === 'Dental' ? 'DEN' : service === 'Medical' ? 'MED' : 'NUT';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
};
