export interface IUserDetailResponse {
    status: boolean;
    user: {
        user_id: string;
        name: string;
        balance: number;
        operatorId: string;
    };
}

export interface Info {
    urId: string;
    urNm: string;
    bl: number;
    sid: string;
    operatorId: string;
    gmId: string;
    token: string;
}

/* TRANSACTION INTERFACES */
export interface IPlayerDetails {
    game_id: string;
    operatorId: string;
    token: string;
}

export interface IBetObject {
    id: string;
    bet_amount: number;
    winning_amount?: number;
    game_id: string;
    user_id: string;
    txn_id?: string;
    ip?: string;
}

export interface IWebhookData {
    txn_id: string;
    ip?: string;
    game_id: string;
    user_id: string;
    amount?: number;
    description?: string;
    bet_id?: string;
    txn_type?: number;
    txn_ref_id?: string;
}

// GAME_SETTINGS
export interface IGameSettings {
    min_amt: number;
    max_amt: number;
    max_co: number;
    win_mult: number;
    tie_mult: number;
    cardInfo: Record<number, ICardInfo>;
    teams: Record<number, string>;
}

export interface ICardInfo {
    card: string;
    type: string;
    runs: number | string;
    fId: string;
}

export interface IRoundResult {
    a: number;
    b: number;
    teamA: string;
    teamB: string;
    teamACards: ICardInfo[];
    teamBCards: ICardInfo[];
    teamAScore: number;
    teamBScore: number;
    winner: number | "TIE";
}

export interface ITeamInfo { teamA: string, a: number, teamB: string, b: number }