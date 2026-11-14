import type { PlayerDossierData } from '../data/samplePlayer';

export function searchPlayerDirectory(
  directory: PlayerDossierData[],
  query: string,
): PlayerDossierData[] {
  const q = query.trim().toLowerCase();
  if (!q) return directory;

  const isRegionCode =
    q.length === 2 &&
    directory.some((entry) => (entry.info.reg_country || '').toLowerCase() === q);

  return directory.filter((entry) => {
    const { info, frequentBySeason } = entry;
    if (isRegionCode) {
      return (
        (info.reg_country || '').toLowerCase() === q ||
        info.name.toLowerCase() === q
      );
    }

    if (info.name.toLowerCase().includes(q)) return true;
    if (String(info.roleId).includes(q)) return true;
    if (String(info.zoneId).includes(q)) return true;
    if (`${info.roleId} (${info.zoneId})`.includes(q)) return true;
    if ((info.reg_country || '').toLowerCase().includes(q)) return true;

    for (const heroes of Object.values(frequentBySeason)) {
      if (
        heroes.some((h) => (h.hid_e?.n || '').toLowerCase().includes(q))
      ) {
        return true;
      }
    }
    return false;
  });
}

export function findPlayerInDirectory(
  directory: PlayerDossierData[],
  criteria: { roleId?: number; name?: string },
): PlayerDossierData | undefined {
  if (criteria.roleId) {
    const byId = directory.find((p) => p.info.roleId === criteria.roleId);
    if (byId) return byId;
  }
  if (criteria.name) {
    const target = criteria.name.trim().toLowerCase();
    return directory.find((p) => p.info.name.trim().toLowerCase() === target);
  }
  return undefined;
}
