import { Scene } from "phaser";
import { GAME_WINDOW_HEIGHT, GAME_WINDOW_WIDTH } from "../../constants";
import { playSoundEffect } from "../audio";
import { setGuestMode, isGuestMode, supabase } from "../supabaseClient";

type AuthLaunchData = { forceLogin?: boolean };

export class Auth extends Scene {
  private forceLogin = false;
  private busy = false;

  constructor() {
    super("Auth");
  }

  init(data: AuthLaunchData = {}) {
    this.forceLogin = data.forceLogin ?? false;
    this.busy = false;
  }

  async create() {
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT, 0xe8f5fa).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WINDOW_WIDTH, 710, 0xd5eff5).setOrigin(0);
    const decor = this.add.graphics();
    decor.fillStyle(0x70d7c2, 0.2).fillCircle(130, 240, 75);
    decor.fillStyle(0xffcb68, 0.22).fillCircle(930, 1450, 110);
    this.add.text(GAME_WINDOW_WIDTH / 2, 320, "🦁", { fontSize: 110 }).setOrigin(0.5);
    this.add.text(GAME_WINDOW_WIDTH / 2, 440, "사자 구슬 게임", {
      color: "#244657", fontSize: 48, fontStyle: "bold",
    }).setOrigin(0.5);
    this.add.text(GAME_WINDOW_WIDTH / 2, 510, "원하는 방식으로 바로 시작하세요", {
      color: "#4c7180", fontSize: 20,
    }).setOrigin(0.5);

    if (!this.forceLogin) {
      try {
        const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
        if (data.session?.user) {
          setGuestMode(false);
          this.scene.start("Lobby");
          return;
        }
      } catch {
        // Authentication can still be bypassed with guest play.
      }
      if (isGuestMode()) {
        this.scene.start("Lobby");
        return;
      }
    }
    this.showLoginPanel();
  }

  private showLoginPanel() {
    const panel = document.createElement("div");
    panel.style.cssText = [
      "box-sizing:border-box", "width:min(520px,90vw)", "padding:34px 38px 30px",
      "border:2px solid #ffffff", "border-radius:28px", "background:#fffaf0",
      "box-shadow:0 18px 50px rgba(41,77,91,.18)", "color:#244657",
      "font-family:system-ui,'Segoe UI',sans-serif", "text-align:center",
    ].join(";");
    panel.innerHTML = `
      <div style="font-size:24px;font-weight:800;margin-bottom:8px">로그인하고 이어서 플레이</div>
      <div style="font-size:14px;color:#71888a;margin-bottom:22px">이메일은 가입 후 사용할 수 있어요</div>
      <form id="email-form" style="margin:0">
        <input id="email" type="email" autocomplete="email" placeholder="이메일 주소" required
          style="box-sizing:border-box;width:100%;height:52px;padding:0 15px;margin:0 0 10px;border:1px solid #cbdcda;border-radius:13px;background:#fff;font-size:16px;color:#244657;outline-color:#38a888">
        <input id="password" type="password" autocomplete="current-password" placeholder="비밀번호 (6자 이상)" minlength="6" required
          style="box-sizing:border-box;width:100%;height:52px;padding:0 15px;margin:0 0 13px;border:1px solid #cbdcda;border-radius:13px;background:#fff;font-size:16px;color:#244657;outline-color:#38a888">
        <button id="email-login" type="submit" style="width:100%;height:50px;border:0;border-radius:13px;background:#38a888;color:white;font-weight:750;font-size:16px;cursor:pointer">이메일로 로그인</button>
        <button id="email-signup" type="button" style="width:100%;height:46px;margin-top:8px;border:1px solid #b8d2d9;border-radius:13px;background:#f3f8f5;color:#315a69;font-weight:700;font-size:15px;cursor:pointer">이메일로 회원가입</button>
      </form>
      <button id="guest-play" type="button" style="width:100%;height:48px;margin-top:18px;border:0;border-radius:13px;background:#e7f1f3;color:#315a69;font-weight:700;font-size:15px;cursor:pointer">게스트로 플레이</button>
      <div id="auth-message" role="status" style="min-height:22px;margin-top:13px;color:#a9543d;font-size:13px;line-height:1.5"></div>
      <div style="margin-top:7px;color:#8b9b9e;font-size:11px">게스트는 계정 연동 기능 없이 게임을 즐길 수 있습니다</div>
    `;
    this.add.dom(GAME_WINDOW_WIDTH / 2, 1005, panel).setOrigin(0.5).setDepth(10);

    const byId = <T extends HTMLElement>(id: string) => panel.querySelector<T>(`#${id}`)!;
    const email = byId<HTMLInputElement>("email");
    const password = byId<HTMLInputElement>("password");
    const message = byId<HTMLDivElement>("auth-message");
    const form = byId<HTMLFormElement>("email-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.signIn(email.value.trim(), password.value, message);
    });
    byId("email-signup").addEventListener("click", () => {
      void this.signUp(email.value.trim(), password.value, message);
    });
    byId("guest-play").addEventListener("click", () => {
      playSoundEffect("ui");
      setGuestMode(true);
      this.scene.start("Lobby");
    });
  }

  private async signIn(email: string, password: string, message: HTMLElement) {
    if (!this.beginRequest(message)) return;
    if (!email || !password) return this.finishRequest(message, "이메일과 비밀번호를 입력해 주세요.");
    if (!supabase) return this.finishRequest(message, "로그인 연결 설정이 없습니다. 게스트로 플레이할 수 있습니다.");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return this.finishRequest(message, "이메일 또는 비밀번호를 확인해 주세요.");
      setGuestMode(false);
      playSoundEffect("ui");
      this.scene.start("Lobby");
    } catch {
      this.finishRequest(message, "로그인 연결에 실패했습니다. 인터넷 연결을 확인해 주세요.");
    }
  }

  private async signUp(email: string, password: string, message: HTMLElement) {
    if (!this.beginRequest(message)) return;
    if (!email.includes("@")) return this.finishRequest(message, "올바른 이메일 주소를 입력해 주세요.");
    if (!supabase) return this.finishRequest(message, "가입 연결 설정이 없습니다. 게스트로 플레이할 수 있습니다.");
    if (password.length < 6) return this.finishRequest(message, "비밀번호는 6자 이상 입력해 주세요.");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
      });
      if (error) return this.finishRequest(message, "가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
      if (!data.session) {
        return this.finishRequest(message, "가입 확인 이메일을 보냈습니다. 메일의 확인 링크를 누른 뒤 로그인해 주세요.");
      }
      setGuestMode(false);
      this.scene.start("Lobby");
    } catch {
      this.finishRequest(message, "가입 연결에 실패했습니다. 인터넷 연결을 확인해 주세요.");
    }
  }

  private beginRequest(message: HTMLElement) {
    if (this.busy) return false;
    this.busy = true;
    message.textContent = "처리 중입니다…";
    return true;
  }

  private finishRequest(message: HTMLElement, text: string) {
    this.busy = false;
    message.textContent = text;
  }
}
