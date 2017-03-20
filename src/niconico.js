const NicoSession = require("./NicoSession");
const deepFreeze = require("deep-freeze");

module.exports = {
    /**
     * @return {Promise}
     */
    restoreSession(json) {
        return NicoSession.fromJSON(json);
    },

    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     * @return {Promise}
     */
    restoreFromSessionId(sessionId) {
        return NicoSession.fromSessionId(sessionId);
    },


    /**
     * ニコニコ動画へログインし、セッションを取得します。
     *
     * @static
     * @method login
     * @param {String}   user        ログインユーザーID
     * @param {String}   password    ログインパスワード
     * @return {Promise}
     */
    login(user, password) {
        return NicoSession.login(user, password);
    },


    Nsen : deepFreeze({
        RequestError  : {
            NO_LOGIN        : "not_login",
            CLOSED          : "nsen_close",
            REQUIRED_TAG    : "nsen_tag",
            TOO_LONG        : "nsen_long",
            REQUESTED       : "nsen_requested"
        },

        Gage : {
            BLUE    : 0,
            GREEN   : 1,
            YELLOW  : 2,
            ORANGE  : 3,
            RED     : 4
        }
    })
};
