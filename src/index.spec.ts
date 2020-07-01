import { NicoAPI } from "./index";

describe("index", () => {
  let session: NicoSession;

  beforeAll(async () => {
    session = await NicoAPI.login("", "");
    console.log(session);
  });

  describe("NicoLive API", () => {
    it("", async () => {
      const live = await NicoLiveApi.getLiveSession(session, "lv326443335");
      console.log(live);

      await live.connect();

      live.onDidReceiveComment((comment) => {
        console.log(comment);
      });
    });
  });
});
