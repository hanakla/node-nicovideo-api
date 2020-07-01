import NicoSession from "./NicoSession";

export * as Entity from "./Entity/index";
import * as Live from "./live/index";
import * as Video from "./video/NicoVideoApi";
import * as User from "./user/NicoUserApi";
// import * as MyList from "./mylist/index";

export { default as NicoException } from "./NicoException";
export { default as NicoSession } from "./NicoSession";

export const NicoAPI = {
  /** ニコニコ動画へログインし、セッションを取得します。 */
  login(user: string, password: string): Promise<NicoSession> {
    return NicoSession.login(user, password);
  },

  restoreSessionFromJSON(json: any) {
    return NicoSession.fromJSON(json);
  },

  restoreSessionFromId(sessionId: string) {
    return NicoSession.fromSessionId(sessionId);
  },

  Live,
  Video,
  User,
  // MyList,
};

export default NicoAPI;
