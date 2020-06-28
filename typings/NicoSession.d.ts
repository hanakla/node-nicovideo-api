/// <reference types="request" />
import { CookieJar } from 'request';
import NicoLiveAPI from './live/NicoLiveApi';
import NicoVideoAPI from './video/NicoVideoApi';
import NicoMyListAPI from './mylist/NicoMyListApi';
import NicoUserAPI from './user/NicoUserAPI';
export default class NicoSession {
    /**
     * @return {Promise}
     */
    static fromJSON(object: object, user?: string, password?: string): Promise<NicoSession>;
    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     * @return {Promise}
     */
    static fromSessionId(sessionId: string): Promise<NicoSession>;
    /**
     * ニコニコ動画のログインセッションを確立します。
     * @param {String}   user        ログインユーザーID
     * @param {String}   password    ログインパスワード
     * @return {Promise}
     */
    static login(user: string, password: string): Promise<NicoSession>;
    private _liveApi;
    private _videoApi;
    private _mylistApi;
    private _userApi;
    sessionId: string;
    cookie: CookieJar;
    /**
     * @property cookie
     * @type request.CookieJar
     */
    readonly live: NicoLiveAPI;
    readonly video: NicoVideoAPI;
    readonly mylist: NicoMyListAPI;
    readonly user: NicoUserAPI;
    private constructor();
    /**
     * ログアウトします。
     * @method logout
     * @return {Promise}
     */
    logout(): Promise<void>;
    /**
     * セッションが有効であるか調べます。
     * @method isActive
     * @return {Promise}
     *   ネットワークエラー時にrejectされます
     * - Resolve: (state: Boolean)
     */
    isActive(): Promise<boolean>;
    toJSON(): any;
}
