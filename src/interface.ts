export interface GameResult {
    teamA: string;
    teamB: string;
    cardsA: string[];
    cardsB: string[];
    pointsA: number;
    pointsB: number;
    wicketA: number;
    wicketB: number;
    winner: 1 | 2 | 3 | null
}