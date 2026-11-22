import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { GameSnapshot } from "../system";

export type OnlinePlayer = {
  playerId: string;
  isHost: boolean;
  joinedAt: number;
};

export type OnlineStartInfo = {
  mapIndex: number;
  obstaclesEnabled: boolean;
  playerIds: string[];
};

export type OnlineShot = {
  playerId: string;
  directionX: number;
  directionY: number;
  spreadRadians: number;
  randomUnit: number;
};

export type OnlineRestartInfo = {
  initialMapIndex: number;
  initialScores?: number[];
};

type PresenceMember = OnlinePlayer & { presence_ref?: string };

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey)
  : null;

export function isOnlineConfigured() {
  return supabase !== null;
}

export class OnlineRoom {
  readonly playerId = createId();
  readonly joinedAt = Date.now();
  private channel: RealtimeChannel | null = null;
  private playersChanged?: (players: OnlinePlayer[]) => void;
  private gameStarted?: (info: OnlineStartInfo) => void;
  private shotReceived?: (shot: OnlineShot) => void;
  private snapshotReceived?: (snapshot: GameSnapshot) => void;
  private gameRestarted?: (info: OnlineRestartInfo) => void;
  private roomClosed?: () => void;

  private constructor(readonly code: string, readonly isHost: boolean) {}

  static async create() {
    const room = new OnlineRoom(createRoomCode(), true);
    await room.connect();
    return room;
  }

  static async join(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalizedCode)) {
      throw new Error("방 코드는 영문 대문자와 숫자 8자리입니다.");
    }
    const room = new OnlineRoom(normalizedCode, false);
    await room.connect();
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (!room.players.some((player) => player.isHost)) {
      await room.leave();
      throw new Error("해당 방을 찾지 못했습니다. 방 코드를 확인해 주세요.");
    }
    if (room.players.length > 4) {
      await room.leave();
      throw new Error("이 방은 이미 최대 인원 4명이 참가했습니다.");
    }
    return room;
  }

  get players(): OnlinePlayer[] {
    if (!this.channel) return [];
    const presence = this.channel.presenceState<PresenceMember>();
    const uniquePlayers = new Map<string, OnlinePlayer>();
    Object.values(presence).flat().forEach((member) => {
      if (member.playerId) {
        uniquePlayers.set(member.playerId, {
          playerId: member.playerId,
          isHost: member.isHost,
          joinedAt: member.joinedAt,
        });
      }
    });
    return [...uniquePlayers.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId));
  }

  onPlayersChanged(callback: (players: OnlinePlayer[]) => void) {
    this.playersChanged = callback;
    callback(this.players);
  }

  onGameStarted(callback: (info: OnlineStartInfo) => void) {
    this.gameStarted = callback;
  }

  onShot(callback: (shot: OnlineShot) => void) {
    this.shotReceived = callback;
  }

  onSnapshot(callback: (snapshot: GameSnapshot) => void) {
    this.snapshotReceived = callback;
  }

  onGameRestarted(callback: (info: OnlineRestartInfo) => void) {
    this.gameRestarted = callback;
  }

  onClosed(callback: () => void) {
    this.roomClosed = callback;
  }

  async startGame(info: OnlineStartInfo) {
    if (!this.isHost || info.playerIds.length < 2 || info.playerIds.length > 4) {
      return false;
    }
    return this.send("game-start", info);
  }

  async sendShot(shot: OnlineShot) {
    return this.send("game-shot", shot);
  }

  async sendSnapshot(snapshot: GameSnapshot) {
    return this.send("game-snapshot", snapshot);
  }

  async restartGame(info: OnlineRestartInfo) {
    if (!this.isHost) return false;
    return this.send("game-restart", info);
  }

  async leave() {
    const channel = this.channel;
    this.channel = null;
    this.playersChanged = undefined;
    this.gameStarted = undefined;
    this.shotReceived = undefined;
    this.snapshotReceived = undefined;
    this.gameRestarted = undefined;
    this.roomClosed = undefined;
    if (channel) {
      await channel.untrack();
      await channel.unsubscribe();
    }
  }

  async close() {
    if (this.isHost) await this.send("room-closed", {});
    await this.leave();
  }

  private async send(event: string, payload: unknown) {
    if (!this.channel) return false;
    const result = await this.channel.send({ type: "broadcast", event, payload });
    return result === "ok";
  }

  private async connect() {
    if (!supabase) {
      throw new Error("온라인 연결 설정을 찾을 수 없습니다. 배포된 웹 게임에서 다시 시도해 주세요.");
    }

    const channel = supabase.channel(`lion-room:${this.code}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: this.playerId },
        private: false,
      },
    });
    this.channel = channel;
    channel.on("presence", { event: "sync" }, () => {
      this.playersChanged?.(this.players);
    });
    channel.on("broadcast", { event: "game-start" }, ({ payload }) => {
      this.gameStarted?.(payload as OnlineStartInfo);
    });
    channel.on("broadcast", { event: "game-shot" }, ({ payload }) => {
      this.shotReceived?.(payload as OnlineShot);
    });
    channel.on("broadcast", { event: "game-snapshot" }, ({ payload }) => {
      this.snapshotReceived?.(payload as GameSnapshot);
    });
    channel.on("broadcast", { event: "game-restart" }, ({ payload }) => {
      this.gameRestarted?.(payload as OnlineRestartInfo);
    });
    channel.on("broadcast", { event: "room-closed" }, () => {
      this.roomClosed?.();
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("온라인 방 연결 시간이 초과됐습니다.")), 10000);
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            window.clearTimeout(timeout);
            try {
              await channel.track({ playerId: this.playerId, isHost: this.isHost, joinedAt: this.joinedAt });
              resolve();
            } catch {
              reject(new Error("대기실 참가에 실패했습니다. 다시 시도해 주세요."));
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            window.clearTimeout(timeout);
            reject(new Error("온라인 방에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."));
          }
        });
      });
    } catch (error) {
      await this.leave();
      throw error;
    }
  }
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
