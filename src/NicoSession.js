import cheerio from 'cheerio';
import Request from 'request-promise';
import ToughCookie from 'tough-cookie';
import { SerializeCookieStore } from 'tough-cookie-serialize';

import APIEndpoints from '../APIEndpoints'
import NicoLiveAPI from './live/NicoLiveApi';
import NicoVideoAPI from './video/NicoVideoApi';
import NicoMyListAPI from './mylist/NicoMyListApi';
import NicoUserAPI from './user/NicoUserAPI';
import {NicoException} from './errors/';
import ErrorCode from './ErrorCode';

class NicoSession {
    static services = new WeakMap();

    /**
     * @property live
     * @type NicoLive
     */

    /**
     * @property video
     * @type NicoVideo
     */

    /**
     * @property mylist
     * @type NicoMyList
     */

    /**
     * @property sessionId
     * @type String
     */

    /**
     * @property cookie
     * @type request.CookieJar
     */

    constructor() {
        Object.defineProperties(this, {
            live    : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, store = {});
                    return store.live != null ? store.live : (store.live = new NicoLiveAPI(this));
                }
            },

            video   : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, store = {});
                    return store.video != null ? store.video : (store.video = new NicoVideoAPI(this));
                }
            },

            mylist  : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, store = {});
                    return store.mylist != null ? store.mylist : (store.mylist = new NicoMyListAPI(this));
                }
            },

            user    : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, store = {});
                    return store.user != null ? store.user : (store.user = new NicoUserAPI(this));
                }
            }
        }
        );
    }

    /**
     * 再ログインします。
     * @return {Promise}
     */
    async relogin(user, password) {
        const res = await APIEndpoints.Auth.login(this.cookie, {user, password});

        if (res.statusCode === 503) {
            throw new NicoException({
                message: 'Nicovideo has in maintenance.',
                code: ErrorCode.NICOVIDEO_MAINTENANCE,
                response: res,
            });
        }
    }


    /**
     * ログアウトします。
     * @method logout
     * @return {Promise}
     */
    async logout() {
        const res = await APIEndpoints.Auth.logout(this.cookie);

        if (res.statusCode === 503) {
            throw new NicoException({
                message: 'Nicovideo has in maintenance.',
                code: ErrorCode.NICOVIDEO_MAINTENANCE,
                response: res,
            });
        }
    }


    /**
     * セッションが有効であるか調べます。
     * @method isActive
     * @return {Promise}
     *   ネットワークエラー時にrejectされます
     * - Resolve: (state: Boolean)
     */
    async isActive() {
        // ログインしてないと使えないAPIを叩く
        const res = await APIEndpoints.Auth.activityCheck(this.cookie);
        const $err = cheerio(res.body).find('error code');
        return $err.length === 0;
    }

    toJSON() {
        return JSON.parse(this.cookie._jar.store.toString());
    }
}

export default {
    /**
     * @return {Promise}
     */
    async fromJSON(object, user = null, password = null) {
        const session = new NicoSession();
        const store = new SerializeCookieStore();
        store.fromString(JSON.stringify(object));

        const cookie = Request.jar(store);

        if (user != null) {
            Object.defineProperty(session, '_user', {value : user});
        }

        Object.defineProperty(session, 'cookie', {value : cookie});

        await new Promise((resolve, reject) => {
            store.findCookie('nicovideo.jp', '/', 'user_session', function(err, cookie) {
                if (err || cookie == null) {
                    reject(new NicoException({
                        message : `Cookie 'user_session' not found.`,
                    }));
                }

                session._sessionId = cookie.value;
                resolve();
            });
        });

        return session;
    },

    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     */
    async fromSessionId(sessionId) {
        const session = new NicoSession();
        const store = new SerializeCookieStore();
        const cookieJar = Request.jar(store);

        const nicoCookie = new ToughCookie.Cookie({
            key : 'user_session',
            value : sessionId,
            domain : '.nicovideo.jp',
            path : '/',
            httpOnly : false,
        });

        await new Promise(resolve => {
            store.putCookie(nicoCookie, function() {
                session.sessionId = sessionId;

                Object.defineProperties(session, {
                    _user : {
                        value : null
                    },
                    cookie : {
                        value : cookieJar
                    },
                    sessionId : {
                        configurable : true,
                        value : sessionId
                    }
                });

                resolve(session);
            });
        });

        return session;
    },

    /**
     * ニコニコ動画のログインセッションを確立します。
     * @param {String}   user        ログインユーザーID
     * @param {String}   password    ログインパスワード
     * @return {Promise}
     */
    async login(user, password) {
        const cookie = Request.jar(new SerializeCookieStore());
        const res = await APIEndpoints.Auth.login(cookie, {user, password});

        if (res.statusCode === 503) {
            throw new NicoException({
                message: 'Nicovideo has in maintenance.',
                code: ErrorCode.NICOVIDEO_MAINTENANCE,
                response: res,
            });
        }

        const sessionId = await new Promise((resolve, reject) => {
            cookie._jar.store
            .findCookie('nicovideo.jp', '/', 'user_session', (err, cookie) => {
                if (cookie != null) {
                    resolve(cookie.value);
                } else if (err != null) {
                    reject('Authorize failed');
                } else {
                    reject('Authorize failed (reason unknown)');                }

            });
        })

        let session = new NicoSession();
        session.sessionId = sessionId;

        Object.defineProperties(session, {
            cookie : {
                value : cookie
            },
            sessionId : {
                configurable : true,
                value : sessionId
            }
        });

        return session;
    }
};
