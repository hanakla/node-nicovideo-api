import NicoSession from './NicoSession'

import * as Entity from './Entity/index'
export {Entity}

import * as NicoLiveApi from './live/NicoLiveApi'
export {NicoLiveApi}

import * as NicoVideoApi from './video/NicoVideoApi'
export {NicoVideoApi}

import * as NicoUserApi from './user/NicoUserApi'
export {NicoUserApi}

export {default as NicoException} from './NicoException'
export {default as NicoSession} from './NicoSession'

// TODO: MyListAPI

export const restoreSessionFromJSON = (json: any) => {
    return NicoSession.fromJSON(json)
}

/**
 * @method restoreFromSessionId
 * @param {String} sessionId
 * @return {Promise}
 */
export const restoreFromSessionId = (sessionId: string) => {
    return NicoSession.fromSessionId(sessionId)
}

/**
 * ニコニコ動画へログインし、セッションを取得します。
 *
 * @static
 * @method login
 * @param {String}   user        ログインユーザーID
 * @param {String}   password    ログインパスワード
 * @return {Promise}
 */
export const login = (user: string , password: string): Promise<NicoSession> =>
{
    return NicoSession.login(user, password);
}

