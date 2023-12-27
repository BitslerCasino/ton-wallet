import { MigrationInterface, QueryRunner } from 'typeorm';

export class Kyt1701782480801 implements MigrationInterface {
  name = 'Kyt1701782480801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_deposit" ("hash" varchar(44) NOT NULL, "lt" varchar(100) NOT NULL, "status" varchar(11) NOT NULL DEFAULT ('pending'), "retries" integer NOT NULL DEFAULT (0), "nextRetry" datetime, "fromAddress" varchar(100) NOT NULL, "fromUserFriendly" varchar(100) NOT NULL, "toUserFriendly" varchar(100) NOT NULL, "amount" float NOT NULL, "wcBlockNumber" varchar(100) NOT NULL, "shard" varchar(100) NOT NULL, "workchain" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), "kytStatus" varchar(10), PRIMARY KEY ("hash", "fromAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_deposit"("hash", "lt", "status", "retries", "nextRetry", "fromAddress", "fromUserFriendly", "toUserFriendly", "amount", "wcBlockNumber", "shard", "workchain", "createdAt", "lastUpdatedAt") SELECT "hash", "lt", "status", "retries", "nextRetry", "fromAddress", "fromUserFriendly", "toUserFriendly", "amount", "wcBlockNumber", "shard", "workchain", "createdAt", "lastUpdatedAt" FROM "deposit"`,
    );
    await queryRunner.query(`DROP TABLE "deposit"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_deposit" RENAME TO "deposit"`,
    );

    await queryRunner.query(
      `CREATE TABLE "temporary_address" ("address" varchar(100) PRIMARY KEY NOT NULL, "userFriendlyAddress" varchar(100) NOT NULL, "path" varchar(100) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), "version" integer NOT NULL)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_address"("address", "userFriendlyAddress", "path", "createdAt", "lastUpdatedAt", "version") SELECT "address", "userFriendlyAddress", "path", "createdAt", "lastUpdatedAt", 1 FROM "address"`,
    );
    await queryRunner.query(`DROP TABLE "address"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_address" RENAME TO "address"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deposit" RENAME TO "temporary_deposit"`,
    );
    await queryRunner.query(
      `CREATE TABLE "deposit" ("hash" varchar(44) NOT NULL, "lt" varchar(100) NOT NULL, "status" varchar(11) NOT NULL DEFAULT ('pending'), "retries" integer NOT NULL DEFAULT (0), "nextRetry" datetime, "fromAddress" varchar(100) NOT NULL, "fromUserFriendly" varchar(100) NOT NULL, "toUserFriendly" varchar(100) NOT NULL, "amount" float NOT NULL, "wcBlockNumber" varchar(100) NOT NULL, "shard" varchar(100) NOT NULL, "workchain" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("hash", "fromAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "deposit"("hash", "lt", "status", "retries", "nextRetry", "fromAddress", "fromUserFriendly", "toUserFriendly", "amount", "wcBlockNumber", "shard", "workchain", "createdAt", "lastUpdatedAt") SELECT "hash", "lt", "status", "retries", "nextRetry", "fromAddress", "fromUserFriendly", "toUserFriendly", "amount", "wcBlockNumber", "shard", "workchain", "createdAt", "lastUpdatedAt" FROM "temporary_deposit"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_deposit"`);

    await queryRunner.query(
      `ALTER TABLE "address" RENAME TO "temporary_address"`,
    );
    await queryRunner.query(
      `CREATE TABLE "address" ("address" varchar(100) PRIMARY KEY NOT NULL, "userFriendlyAddress" varchar(100) NOT NULL, "path" varchar(100) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUpdatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "address"("address", "userFriendlyAddress", "path", "createdAt", "lastUpdatedAt") SELECT "address", "userFriendlyAddress", "path", "createdAt", "lastUpdatedAt" FROM "temporary_address"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_address"`);
  }
}
