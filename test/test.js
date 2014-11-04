var USER = global.NU,
    PASS = global.NP,
    LIVE = "nsen/toho";

global.Nico = require("node-nicovideo-api");

global.nico = new Nico(/*USER, PASS*/);
global.nico.session.setSessionId("user_session_4179445_6ca3ebd9b67360a8d23ae2f5791ec7aa25e3190226c1c96892751138f3353eb5");
global.live = null;
global.cp   = null;
global.nsen = null;

nico.loginThen(function () {
    nico.live.getLiveInfo(LIVE)
        .then(function (info) {
            global.live = info;
            global.cp = info.commentProvider();
            global.nsen = nico.live.getNsenChannelHandlerFor(info);
            console.log("ready");
        })
});
