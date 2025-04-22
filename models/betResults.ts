import { pool } from "../db/dbConnection";
import type { ITeamInfo } from "../interfaces";

export class BetResults {
    static async create({ user_id, match_id, operator_id, bet_amt, bet_values, team_info }: {
        user_id: string;
        match_id: string;
        operator_id: string;
        bet_amt: number;
        bet_values: Record<string, number>;
        team_info: ITeamInfo;
    }) {
        const query = `
            INSERT INTO bet_results (user_id, match_id, operator_id, bet_amt, bet_values, team_info)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const values = [user_id, match_id, operator_id, bet_amt, JSON.stringify(bet_values), JSON.stringify(team_info)];
        const [result] = await pool.execute(query, values);
        return result;
    }

    static async findById(id: number) {
        const [rows]: any = await pool.query(`SELECT * FROM bet_results WHERE id = ?`, [id]);
        return rows[0] || null;
    }

    static async find(user_id: string, operator_id: string, limit = 50) {
        const [rows]: any = await pool.query(`SELECT * FROM bet_results WHERE user_id = ? AND operator_id = ? ORDER BY created_at DESC LIMIT ?`, [user_id, operator_id, limit]);
        return rows;
    }

    static async findByMatchId(user_id: string, operator_id: string, match_id: string) {
        const [rows]: any = await pool.query(`SELECT * FROM bet_results WHERE user_id = ? AND operator_id = ? AND match_id = ?`, [user_id, operator_id, match_id]);
        return rows[0] || null;
    }
}
