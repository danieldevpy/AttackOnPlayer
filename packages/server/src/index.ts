import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { summarize } from "./metrics/SessionMetrics";
import { ROOM_NAME, SERVER_PORT } from "@aop/shared";

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/metrics/summary", (_req, res) => res.json(summarize()));

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAME, ArenaRoom);

const port = Number(process.env.PORT ?? SERVER_PORT);
httpServer.listen(port, () => {
  console.log(`[server] AttackOnPlayer em ws://localhost:${port} (HTTP: /health, /metrics/summary)`);
});
