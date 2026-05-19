import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Controller("health")
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    let dbStatus = "down";
    try {
      await this.dataSource.query("SELECT 1");
      dbStatus = "up";
    } catch {
      dbStatus = "down";
    }
    return {
      status: dbStatus === "up" ? "ok" : "degraded",
      service: "autoflow-saga-orchestrator",
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
