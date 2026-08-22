export const PRIORITIES = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Critica' },
];

export const PRIORITY_WEIGHT = { bassa: 0, media: 1, alta: 2, critica: 3 };

export function getStatus(progress) {
  if (progress >= 100) return 'done';
  if (progress > 0) return 'in-progress';
  return 'todo';
}

export const STATUS_META = {
  'todo': { label: 'Da iniziare', color: '#7c8aa5' },
  'in-progress': { label: 'In corso', color: '#f5a623' },
  'done': { label: 'Completata', color: '#22c3a6' },
};
