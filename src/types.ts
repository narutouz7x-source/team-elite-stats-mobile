export type Player = { id: string; name: string; role: string; imageUrl?: string };
export type Tournament = { id: string; name: string; active: boolean; status: 'draft' | 'active' | 'completed'; category?: 'official' | 'scrim'; currentRank?: number; rankDescription?: string };
export type Stage = { id: string; tournamentId: string; name: string; order: number };
export type Match = { id: string; tournamentId: string; matchNumber: number; position: number; totalPoints: number; timestamp: number; mapName?: string; category?: 'official' | 'scrim'; weekId?: string; playerStats?: { playerId: string; kills: number }[] };
export type Settings = { teamName: string; game: string; tagline: string; logoUrl?: string; updatedAt: number };
export type Notification = { id: string; type: 'announcement' | 'content' | 'esports'; title: string; message?: string; url?: string; createdAt: number };
