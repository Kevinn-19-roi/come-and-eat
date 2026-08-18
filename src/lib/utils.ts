export const formatPrice = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
export const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
export const generateSku = (name: string, existing: string[]) => {
  const code = slugify(name).split('-').map((part) => part[0]).join('').slice(0, 3).toUpperCase().padEnd(3, 'X');
  let index = 1; let sku = '';
  do { sku = `CEA-${code}-${String(index++).padStart(4, '0')}`; } while (existing.includes(sku));
  return sku;
};
