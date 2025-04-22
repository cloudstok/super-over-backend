import redis from "redis";
import { createLogger } from "../utilities/logger.ts";
const logger = createLogger("REDIS", "plain");

class RedisClient {
    connection: any;
    constructor() {
        this.initRedis();
    }

    async initRedis() {
        this.connection = redis.createClient({
            url: process.env.REDIS_URL,
            password: process.env.REDIS_PASSWORD,
        });

        if (await this.connection.connect())
            logger.info("Redis read/write connection successful");
        else logger.info("Redis read/write connection unsuccessful");
    }

    async getDataFromRedis(key: string | number) {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            let res = await this.connection.get(key);
            return JSON.parse(res);
        } else return null;
    }

    async setDataToRedis(key: string | number, data: any, ttl: number = 3600) {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            data = JSON.stringify(data);
            let res = await this.connection.set(key, data, { EX: ttl });
            return res;
        } else return 0;
    }

    async delDataFromRedis(key: string | number) {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            let res = await this.connection.del(key);
            return res;
        } else return null;
    }

    async flushDataFromRedis() {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            let res = await this.connection.flushAll();
            return res;
        } else return null;
    }

    async pushToList(key: string | number, data: any) {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            let res = await this.connection.lPush(key, data);
            return res;
        } else return null;
    }

    async popFromList(key: string | number) {
        if (!this.connection) await this.initRedis();
        if (this.connection) {
            let res = await this.connection.rpop(key);
            return res;
        } else return null;
    }
}

export const redisRead = new RedisClient();
export const redisWrite = new RedisClient();