import NicoAPI from "./src/index";

(async () => {
  const session = await NicoAPI.login("0674272bac@gmail.com", "tpv5rhgm");
  console.log(session);

  // const live = await NicoAPI.Live.getLiveSession(session, "lv326443335");
  // // console.log(live);

  // await live.connect();

  // live.onDidReceiveComment((comment) => {
  //   console.log(comment);
  // });

  // Mylist
  const mylistController = new NicoAPI.MyList.MyListController(session);
  console.log(await mylistController.getMyLists());
})();

// describe("index", () => {
//   let session: NicoSession;

//   beforeAll(async () => {

//   });

//   describe("NicoLive API", () => {
//     it("", async () => {

//     });
//   });
// });
