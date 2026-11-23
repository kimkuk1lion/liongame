import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameSnapshot } from "../system";
import type { MarbleAppearance } from "./settings";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export type OnlinePlayer = {
  playerId: string;
  isHost: boolean;
  joinedAt: number;
  appearance: MarbleAppearance;
};

export type OnlineStartInfo = {
  mapIndex: number;
  obstaclesEnabled: boolean;
  playerIds: string[];
  playerAppearances: MarbleAppearance[];
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

export type OnlineRoomListing = {
  code: string;
  title: string;
  hasPassword: boolean;
  playerCount: number;
};

type DirectoryMember = {
  playerId: string;
  roomCode?: string | null;
  roomListing?: { code: string; title: string; hasPassword: boolean; status: "waiting" | "playing" };
  presence_ref?: string;
};

export function isOnlineConfigured() {
  return isSupabaseConfigured();
}

export class OnlineDirectory {
  readonly playerId = createId();
  private channel: RealtimeChannel | null = null;
  private roomsChanged?: (rooms: OnlineRoomListing[]) => void;
  private currentRoomCode: string | null = null;
  private listing: DirectoryMember["roomListing"];

  async connect() {
    if (!supabase) throw new Error("온라인 연결 설정을 찾을 수 없습니다.");
    const channel = supabase.channel("lion-game-room-directory", {
      config: { presence: { key: this.playerId }, private: false },
    });
    this.channel = channel;
    channel.on("presence", { event: "sync" }, () => this.roomsChanged?.(this.rooms));
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("방 목록 연결 시간이 초과됐습니다.")), 10000);
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          try {
            await this.track();
            resolve();
          } catch {
            reject(new Error("방 목록을 불러오지 못했습니다."));
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          window.clearTimeout(timeout);
          reject(new Error("온라인 방 목록에 연결하지 못했습니다."));
        }
      });
    }).catch(async (error) => {
      await this.disconnect();
      throw error;
    });
  }

  get rooms(): OnlineRoomListing[] {
    if (!this.channel) return [];
    const members = Object.values(this.channel.presenceState<DirectoryMember>()).flat();
    const listings = new Map<string, OnlineRoomListing>();
    members.forEach((member) => {
      const listing = member.roomListing;
      if (!listing || listing.status !== "waiting") return;
      const playerCount = members.filter((candidate) => candidate.roomCode === listing.code).length;
      listings.set(listing.code, {
        code: listing.code,
        title: listing.title,
        hasPassword: listing.hasPassword,
        playerCount,
      });
    });
    return [...listings.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  onRoomsChanged(callback: (rooms: OnlineRoomListing[]) => void) {
    this.roomsChanged = callback;
    callback(this.rooms);
  }

  async setRoom(code: string | null, listing?: OnlineRoomListing, status: "waiting" | "playing" = "waiting") {
    this.currentRoomCode = code;
    this.listing = listing ? { ...listing, status } : undefined;
    await this.track();
  }

  async disconnect() {
    const channel = this.channel;
    this.channel = null;
    this.roomsChanged = undefined;
    if (channel) {
      await channel.untrack();
      await channel.unsubscribe();
    }
  }

  private async track() {
    if (!this.channel) return;
    await this.channel.track({ playerId: this.playerId, roomCode: this.currentRoomCode, roomListing: this.listing });
  }
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
  private directory?: OnlineDirectory;

  private constructor(
    readonly code: string,
    readonly isHost: boolean,
    readonly title: string,
    readonly hasPassword: boolean,
    private readonly password: string,
    private readonly appearance: MarbleAppearance,
  ) {}

  static async create(title: string, password: string, directory: OnlineDirectory, appearance: MarbleAppearance) {
    const room = new OnlineRoom(createRoomCode(), true, title, Boolean(password), password, appearance);
    room.directory = directory;
    await room.connect();
    await directory.setRoom(room.code, { code: room.code, title, hasPassword: Boolean(password), playerCount: 1 });
    return room;
  }

  static async join(listing: OnlineRoomListing, password: string, directory: OnlineDirectory, appearance: MarbleAppearance) {
    const normalizedCode = listing.code.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalizedCode)) {
      throw new Error("방 코드는 영문 대문자와 숫자 8자리입니다.");
    }
    const room = new OnlineRoom(normalizedCode, false, listing.title, listing.hasPassword, password, appearance);
    room.directory = directory;
    await room.connect();
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (!room.players.some((player) => player.isHost)) {
      await room.leave();
      throw new Error(listing.hasPassword
        ? "비밀번호가 맞지 않거나 방이 종료됐습니다."
        : "방이 종료됐거나 참가할 수 없습니다.");
    }
    if (room.players.length > 4) {
      await room.leave();
      throw new Error("이 방은 이미 최대 인원 4명이 참가했습니다.");
    }
    await directory.setRoom(room.code);
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
          appearance: member.appearance ?? { kind: "animal", animal: "lion" },
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
    const sent = await this.send("game-start", info);
    if (sent) await this.directory?.setRoom(this.code, undefined, "playing");
    return sent;
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
    await this.directory?.setRoom(null);
    this.directory = undefined;
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

    const topic = await roomTopic(this.code, this.password);
    const channel = supabase.channel(topic, {
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
              await channel.track({
                playerId: this.playerId,
                isHost: this.isHost,
                joinedAt: this.joinedAt,
                appearance: this.appearance,
              });
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

async function roomTopic(code: string, password: string) {
  if (!password) return `lion-room:${code}`;
  const bytes = new TextEncoder().encode(`${code}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `lion-game-private:${code}:${hash}`;
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
