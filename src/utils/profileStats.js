const MEDIA_COUNTER_KEYS = ['movie', 'series', 'anime', 'manga', 'manwha', 'light_novel', 'roman'];

function createEmptyCounters() {
  return MEDIA_COUNTER_KEYS.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {});
}

function toSafeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

export function computeProfileStats(libraryItems = [], topPicks = []) {
  const mediaCounts = createEmptyCounters();
  let watchedMinutes = 0;
  let trackedItems = 0;
  let completedItems = 0;

  for (const item of Array.isArray(libraryItems) ? libraryItems : []) {
    trackedItems += 1;
    if (mediaCounts[item.type] !== undefined) {
      mediaCounts[item.type] += 1;
    }

    if (item.status === 'done') {
      completedItems += 1;
    }

    if (item.type === 'movie') {
      if (item.status !== 'to_start') {
        watchedMinutes += toSafeNumber(item.runtimeMinutes);
      }
      continue;
    }

    if (item.type === 'series' || item.type === 'anime') {
      watchedMinutes += toSafeNumber(item.progressCurrent) * toSafeNumber(item.episodeRuntimeMinutes);
    }
  }

  return {
    trackedItems,
    completedItems,
    topPicksCount: Array.isArray(topPicks) ? topPicks.length : 0,
    watchedMinutes,
    mediaCounts,
  };
}

export function formatMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.round(toSafeNumber(minutes)));
  const totalHours = Math.floor(safeMinutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const days = Math.floor((totalHours % (24 * 30)) / 24);
  const hours = totalHours % 24;
  const parts = [];

  if (months > 0) {
    parts.push(`${months} mois`);
  }

  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  }

  if (hours > 0 || parts.length === 0) {
    parts.push(`${hours} h`);
  }

  return parts.join(' ');
}