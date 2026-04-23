import { compareAsc, isValid, parseISO } from 'date-fns';

export const QUEUE_DISPLAY_STATUSES = {
  CURRENTLY_SERVING: 'Currently Serving',
  UP_NEXT: 'Up Next',
  IN_LINE: 'In Line',
};

function parseQueueDateValue(value) {
  if (!value) return null;

  try {
    const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (isValid(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to return null.
  }

  return null;
}

function getQueueDeduplicationKey(queue) {
  return (
    queue?.id ||
    [
      queue?.appointmentId || queue?.appointment?.id || 'queue',
      queue?.queueNumber || '',
      queue?.checkedInAt || queue?.createdAt || '',
    ].join(':')
  );
}

function dedupeQueues(queues = []) {
  const seen = new Set();

  return queues.filter((queue) => {
    const key = getQueueDeduplicationKey(queue);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function isQueueSkipped(queue) {
  return String(queue?.status || '').trim() === 'Skipped';
}

export function isQueueCompleted(queue) {
  const queueStatus = String(queue?.status || '').trim();
  const appointmentStatus = String(queue?.appointment?.status || '').trim();

  return queueStatus === 'Completed' || appointmentStatus === 'Completed';
}

export function compareQueueCheckInOrder(a, b) {
  const dateA = parseQueueDateValue(a?.checkedInAt || a?.createdAt);
  const dateB = parseQueueDateValue(b?.checkedInAt || b?.createdAt);

  if (dateA && dateB) {
    const comparison = compareAsc(dateA, dateB);
    if (comparison !== 0) return comparison;
  } else if (dateA) {
    return -1;
  } else if (dateB) {
    return 1;
  }

  return String(a?.queueNumber || '').localeCompare(String(b?.queueNumber || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function getCompletedQueueEntries(queues = []) {
  return dedupeQueues(queues)
    .filter((queue) => !isQueueSkipped(queue))
    .filter((queue) => Boolean(queue?.checkedInAt))
    .filter((queue) => isQueueCompleted(queue));
}

export function getQueueDisplayRows(queues = []) {
  const activeQueues = dedupeQueues(queues)
    .filter((queue) => !isQueueSkipped(queue))
    .filter((queue) => Boolean(queue?.checkedInAt))
    .filter((queue) => !isQueueCompleted(queue))
    .sort(compareQueueCheckInOrder);

  const currentServingQueue =
    activeQueues.find((queue) => String(queue?.status || '').trim() === 'Serving') || null;

  const orderedQueues = currentServingQueue
    ? [
        currentServingQueue,
        ...activeQueues.filter((queue) => queue.id !== currentServingQueue.id),
      ]
    : activeQueues;

  let upNextAssigned = false;

  return orderedQueues.map((queue) => {
    let displayStatus = QUEUE_DISPLAY_STATUSES.IN_LINE;

    if (currentServingQueue && queue.id === currentServingQueue.id) {
      displayStatus = QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING;
    } else if (currentServingQueue && !upNextAssigned) {
      displayStatus = QUEUE_DISPLAY_STATUSES.UP_NEXT;
      upNextAssigned = true;
    }

    return {
      ...queue,
      displayStatus,
      isCurrentServing: displayStatus === QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING,
      isUpNext: displayStatus === QUEUE_DISPLAY_STATUSES.UP_NEXT,
      isInLine: displayStatus === QUEUE_DISPLAY_STATUSES.IN_LINE,
    };
  });
}
