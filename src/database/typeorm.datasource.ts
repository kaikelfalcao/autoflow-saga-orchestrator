import "dotenv/config";
import * as path from "path";
import { DataSource } from "typeorm";

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: Number(process.env.DATABASE_PORT || 5433),
  username: process.env.DATABASE_USER || "order_service",
  password: process.env.DATABASE_PASSWORD || "order_service",
  database: process.env.DATABASE_NAME || "order_service",
  entities: [
    path.join(__dirname, "..", "saga", "entities", "*.orm-entity.{ts,js}"),
  ],
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
