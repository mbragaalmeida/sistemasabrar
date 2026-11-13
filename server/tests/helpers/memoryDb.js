/**
 * Banco em memória que atende às consultas usadas por searchLiveMaterialBase.
 * Permite testar associação/precificação sem tocar o banco de produção.
 */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function createMemoryMaterialDb(materials = [], aliases = []) {
  return {
    prepare(sql) {
      const q = sql.replace(/\s+/g, ' ').trim();
      return {
        async get(...params) {
          if (/FROM materials WHERE code = \?/i.test(q)) return materials.find(m => m.code === params[0]);
          if (/FROM materials WHERE LOWER\(name\) = \?/i.test(q)) return materials.find(m => String(m.name).toLowerCase() === params[0]);
          if (/FROM material_aliases/i.test(q)) {
            const a = aliases.find(x => String(x.alias_name).toLowerCase() === params[0]);
            return a ? materials.find(m => m.id === a.material_id) : undefined;
          }
          return undefined;
        },
        async all(...params) {
          if (/unaccent\(m\.name\) ILIKE/i.test(q)) {
            const probe = norm(params[0]).replace(/%/g, '');
            return materials.filter(m => norm(m.name).includes(probe) || norm(m.synonyms).includes(probe)).slice(0, 200);
          }
          return [];
        },
        async run() {
          throw new Error('memoryDb é somente leitura');
        }
      };
    }
  };
}
