import { pool } from "../db/dbConnection"; // MySQL connection pool
import type { IRoundResult } from "../interfaces";

export class Settlements {
    static async create({ user_id, match_id, operator_id, bet_amt, win_amt, bet_values, win_result, status }: {
        user_id: string;
        match_id: string;
        operator_id: string;
        bet_amt: number;
        win_amt: number;
        bet_values: Record<string, number>;
        win_result: IRoundResult;
        status: string;
    }) {
        const query = `
            INSERT INTO settlements (user_id, match_id, operator_id, bet_amt, win_amt, bet_values, win_result, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [user_id, match_id, operator_id, bet_amt, win_amt, JSON.stringify(bet_values), JSON.stringify(win_result), status];
        const [result] = await pool.execute(query, values);
        return result;
    }

    static async fetchLastWin(user_id: string, operator_id: string) {
        const [rows]: any = await pool.query(`SELECT win_amt FROM settlements WHERE user_id = ? AND operator_id = ? ORDER BY created_at DESC LIMIT 1`, [user_id, operator_id]);
        return rows[0] || {};
    }

    static async find(user_id: string, operator_id: string, limit = 10) {
        const [rows]: any = await pool.query(`SELECT * FROM settlements WHERE user_id = ? AND operator_id = ? ORDER BY created_at DESC LIMIT ?`, [user_id, operator_id, limit]);
        return rows;
    }

    static async findByMatchId(user_id: string, operator_id: string, match_id: string) {
        const [rows]: any = await pool.query(`SELECT * FROM settlements WHERE match_id = ? AND user_id = ? AND operator_id = ?`, [match_id, user_id, operator_id]);
        return rows[0] || {};
    }
}
