import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1693411378284 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "param" ("name" varchar PRIMARY KEY NOT NULL, "value" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')));`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "address" ("address" varchar(100) PRIMARY KEY NOT NULL, "path" varchar(100) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userFriendlyAddress" varchar(100) NOT NULL);`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deposit" ("hash" varchar(44) NOT NULL, "status" varchar(11) NOT NULL DEFAULT ('pending'), "retries" integer NOT NULL DEFAULT (0), "nextRetry" datetime, "amount" float NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), "lt" varchar(100) NOT NULL, "fromAddress" varchar(100) NOT NULL, "fromUserFriendly" varchar(100) NOT NULL, "toUserFriendly" varchar(100) NOT NULL, "wcBlockNumber" varchar(100) NOT NULL, "shard" varchar(100) NOT NULL, "workchain" integer NOT NULL, PRIMARY KEY ("hash", "fromAddress"));`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balance" ("address" varchar(100) NOT NULL, "currency" varchar(5) NOT NULL DEFAULT ('TON'), "amount" float NOT NULL DEFAULT (0), "needUpdate" boolean DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_6a18c33aeed8b1bff59a1128549" FOREIGN KEY ("address") REFERENCES "address" ("address") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("address", "currency"));`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transfer" ("hash" varchar(64) PRIMARY KEY NOT NULL, "fromAddress" varchar(100) NOT NULL, "fromUserFriendly" varchar(100) NOT NULL, "toUserFriendly" varchar(100) NOT NULL, "type" varchar(8) NOT NULL, "currency" varchar(5) NOT NULL, "amount" float, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transfer"`);
    await queryRunner.query(`DROP TABLE "balance"`);
    await queryRunner.query(`DROP TABLE "deposit"`);
    await queryRunner.query(`DROP TABLE "address"`);
    await queryRunner.query(`DROP TABLE "param"`);
  }
}
