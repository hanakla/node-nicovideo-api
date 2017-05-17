import NicoSession from './NicoSession'
import * as NicoVideoApi from './video/NicoVideoApi'

import * as deepFreeze from 'deep-freeze'

export default {
    /**
     * @return {Promise}
     */
    restoreSession(json: object) {
        return NicoSession.fromJSON(json);
    },

    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     * @return {Promise}
     */
    restoreFromSessionId(sessionId: string) {
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
    login(user: string , password: string): Promise<NicoSession> {
        return NicoSession.login(user, password);
    },


    Nsen : deepFreeze({
        RequestError  : {
            NO_LOGIN        : 'not_login',
            CLOSED          : 'nsen_close',
            REQUIRED_TAG    : 'nsen_tag',
            TOO_LONG        : 'nsen_long',
            REQUESTED       : 'nsen_requested'
        },

        Gage : {
            BLUE    : 0,
            GREEN   : 1,
            YELLOW  : 2,
            ORANGE  : 3,
            RED     : 4
        }
    })
}

export {default as NicoException} from './NicoException'
export {default as NicoSession} from './NicoSession'
export {default as NicoLive} from './live/NicoLiveApi'

export {
    NicoVideoApi
}
