import type { Namespace } from "socket.io";
import { GS } from "../utilities/loadConfig";
import type { ICardInfo, IRoundResult, ITeamInfo } from "../interfaces";
import { settlementHandler } from "../services/handlers";

const enum EStatus { ss = "STARTED", pb = "PLACE_BET", cb = "COLLECT_BET", sc = "SHOW_CARDS", ed = "ENDED" };
const enum EStatusCode { ss = 1, pb = 2, cb = 3, sc = 4, ed = 5 };
const enum EStatusInterval { ss = 2, pb = 15, cb = 4, sc = 15, ed = 5 };

export class InfiniteGameLobby {
    private io: Namespace;
    private status!: EStatus;
    private statusCode!: EStatusCode;
    private roundId!: number;
    private teamsInfo!: ITeamInfo;
    private roundResult!: IRoundResult;
    private prevRoundResults: IRoundResult[] = [];

    constructor(io: Namespace) {
        this.io = io;
        this.initGameLoop();
    }

    async initGameLoop(): Promise<any> {
        await this.mySleep(2 * 1000)
        await this.gameLoop()
    }

    async gameLoop(): Promise<any> {

        this.roundId = Date.now();
        this.teamsInfo = this.getTeams()
        this.setCurrentStatus(EStatus.ss, EStatusCode.ss);
        this.emitStatus();
        this.emitTeamsInfo()
        await this.sleepWithTimer(EStatusInterval.ss);

        this.setCurrentStatus(EStatus.pb, EStatusCode.pb);
        this.emitStatus();
        this.roundResult = this.generateRoundResults();
        this.storeRoundResults();
        await this.sleepWithTimer(EStatusInterval.pb);

        this.setCurrentStatus(EStatus.cb, EStatusCode.cb);
        this.emitStatus();
        await this.sleepWithTimer(EStatusInterval.cb);

        this.setCurrentStatus(EStatus.sc, EStatusCode.sc);
        this.emitStatus();
        this.emitRoundResults()
        await this.sleepWithTimer(EStatusInterval.sc);

        this.setCurrentStatus(EStatus.ed, EStatusCode.ed);
        this.emitStatus();
        await settlementHandler(this.io)
        await this.sleepWithTimer(EStatusInterval.ed);

        return this.gameLoop();
    }

    private mySleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    private async sleepWithTimer(seconds: number): Promise<void> {
        for (let i = seconds; i > 0; i--) {
            this.emitIntervalSeconds(i);
            await this.mySleep(1000);
        }
    }

    private setCurrentStatus(status: EStatus, statusCode: EStatusCode) { this.status = status; this.statusCode = statusCode; console.log(status, statusCode); }
    private storeRoundResults() {
        if (this.prevRoundResults.length >= 3) this.prevRoundResults.shift();
        this.prevRoundResults.push(this.roundResult);
    }

    private emitStatus() { return this.io.emit("message", { event: "game_status", status: this.status }); }
    private emitTeamsInfo() { return this.io.emit("message", { event: "teams_info", teamsInfo: this.teamsInfo }); }
    private emitRoundResults() { return this.io.emit("message", { event: "round_result", roundResult: this.roundResult }); }
    private emitIntervalSeconds(t: number) { return this.io.emit("message", `round:${this.roundId}:${this.statusCode}:${t}`); }

    public getCurrentRoundId(): { roundId: number } { return { roundId: this.roundId }; }
    public getCurrentStatus(): { status: EStatus, statusCode: EStatusCode } { return { status: this.status, statusCode: this.statusCode }; }
    public getTeamInfo(): ITeamInfo { return this.teamsInfo; }
    public getRoundResult(): IRoundResult { return this.roundResult; }
    public getPrevRoundResults(): IRoundResult[] { return this.prevRoundResults; }

    private generateRoundResults(): IRoundResult {
        const { teamA, a, teamB, b } = this.teamsInfo;
        const { teamACards, teamBCards } = this.getTeamsCards();
        const teamAScore: number = this.calculateTotalRuns(teamACards);
        const teamBScore: number = this.calculateTotalRuns(teamBCards);
        const winner = teamAScore === teamBScore ? "TIE" : (teamAScore > teamBScore ? a : b);
        return { a, b, teamA, teamB, teamACards, teamBCards, teamAScore, teamBScore, winner };
    }
    private getTeams(): ITeamInfo {
        const set = new Set<number>();
        while ([...set].length < 2) {
            set.add(Math.floor(Math.random() * 8))
        }
        const a: number = [...set][0];
        const b: number = [...set][1];
        const teamA: string = GS.GAME_SETTINGS.teams![a];
        const teamB: string = GS.GAME_SETTINGS.teams![b];
        return { teamA, a, teamB, b };
    }
    private getCards(): number[] { return Array.from({ length: 6 }, () => Math.floor(Math.random() * Object.keys(GS.GAME_SETTINGS.cardInfo!).length)); }
    private getTeamsCards(): ({ teamACards: ICardInfo[], teamBCards: ICardInfo[] }) {
        const teamACards = this.getCards();
        const teamBCards = this.getCards();
        let wicketsCount = 0;
        [teamBCards, teamACards].forEach(team => {
            team.forEach((v, i) => {
                if (v === 6 && wicketsCount > 2) {
                    team[i] = Math.floor(Math.random() * 6)
                }
            });
        });
        let aCards: ICardInfo[] = [];
        teamACards.forEach(e => aCards.push(GS.GAME_SETTINGS.cardInfo![e]));
        let bCards: ICardInfo[] = [];
        teamBCards.forEach(e => bCards.push(GS.GAME_SETTINGS.cardInfo![e]));

        let kingCount = 0;
        [aCards, bCards].forEach(cardsArr => {
            cardsArr.forEach((card, idx) => {
                if (card.card === "K") kingCount++;
                if (kingCount >= 2) {
                    cardsArr.splice(idx + 1, aCards.length)
                }
            })
            kingCount = 0;
        });
        return { teamACards: aCards, teamBCards: bCards };
    }
    private calculateTotalRuns(cards: ICardInfo[]): number {
        let totalRuns: number = 0;
        cards.forEach(card => {
            if (card.card !== "K" && card.card !== "10" && typeof card.runs === "number") totalRuns += card.runs;
        })
        return totalRuns;
    }
}