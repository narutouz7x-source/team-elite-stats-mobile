const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  settings: () => request<import('./types').Settings>('/api/settings'),
  tournaments: () => request<import('./types').Tournament[]>('/api/tournaments'),
  players: () => request<import('./types').Player[]>('/api/players'),
  matches: () => request<import('./types').Match[]>('/api/matches'),
  stages: (tournamentId: string) => request<import('./types').Stage[]>(`/api/weeks?tournamentId=${encodeURIComponent(tournamentId)}`),
  notifications: () => request<import('./types').Notification[]>('/api/notifications')
};
