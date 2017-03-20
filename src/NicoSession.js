const {Emitter} = require("event-kit");
const cheerio = require("cheerio");
const Request = require("request-promise");
const ToughCookie = require("tough-cookie");
const {SerializeCookieStore} = require("tough-cookie-serialize");
const Deferred = require("promise-native-deferred");

const NicoUrl = require("./NicoURL");
const NicoException = require("./NicoException");
const NicoLiveAPI = require("./live/NicoLiveApi");
const NicoVideoAPI = require("./video/NicoVideoApi");
const NicoMyListAPI = require("./mylist/NicoMyListApi");
const NicoUserAPI = require("./user/NicoUserAPI");

class NicoSession {
    static initClass() {
        this.services  = new WeakMap;
    }

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
                    store || NicoSession.services.set(this, (store = {}));
                    return store.live != null ? store.live : (store.live = new NicoLiveAPI(this));
                }
            },

            video   : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, (store = {}));
                    return store.video != null ? store.video : (store.video = new NicoVideoAPI(this));
                }
            },

            mylist  : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, (store = {}));
                    return store.mylist != null ? store.mylist : (store.mylist = new NicoMyListAPI(this));
                }
            },

            user    : {
                get() {
                    let store = NicoSession.services.get(this);
                    store || NicoSession.services.set(this, (store = {}));
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
    relogin(user, password) {
        return Request.post({
            resolveWithFullResponse : true,
            followAllRedirects : true,
            url : NicoUrl.Auth.LOGIN,
            jar : this.cookie,
            form : {
                mail_tel : user,
                password
            }}).then(function(res) {
            if (res.statusCode === 503) { return Promise.reject("Nicovideo has in maintenance."); }
        });
    }


    /**
     * ログアウトします。
     * @method logout
     * @return {Promise}
     */
    logout() {
        return Request.post({
            resolveWithFullResponse : true,
            url : NicoUrl.Auth.LOGOUT,
            jar : this.cookie}).then(res => {
            if (res.statusCode === 503) { return Promise.reject("Nicovideo has in maintenance."); }
        }
        );
    }


    /**
     * セッションが有効であるか調べます。
     * @method isActive
     * @return {Promise}
     *   ネットワークエラー時にrejectされます
     * - Resolve: (state: Boolean)
     */
    isActive() {
        // ログインしてないと使えないAPIを叩く
        return Request.get({
            resolveWithFullResponse : true,
            url : NicoUrl.Auth.LOGINTEST,
            jar : this.cookie}).then(function(res) {
            const $res = cheerio(res.body);
            const $err = $res.find("error code");

            return Promise.resolve($err.length === 0);
        });
    }

    toJSON() {
        return JSON.parse(this.cookie._jar.store.toString());
    }


    /**
     * このインスタンスを破棄します。
     * @method dispose
     */
}
NicoSession.initClass();

module.exports = {
    /**
     * @return {Promise}
     */
    fromJSON(object, user, password) {
        if (user == null) { user = null; }
        if (password == null) { password = null; }
        const defer = new Deferred;

        const store = new SerializeCookieStore();
        store.fromString(JSON.stringify(object));
        const cookie = Request.jar(store);

        const session = new NicoSession;
        (password != null) && Store.set(session, password);

        (user != null) && Object.defineProperty(session, "_user", {value : user});
        Object.defineProperty(session, "cookie", {value : cookie});

        store.findCookie("nicovideo.jp", "/", "user_session", function(err, cookie) {
            return (err != null) || ((cookie == null)) ?
                defer.reject(new NicoException({
                    message : "Cookie 'user_session' not found."})
                ) : undefined;

            session._sessionId = cookie.value;
            return defer.resolve(session);
        });

        return defer.promise;
    },

    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     */
    fromSessionId(sessionId) {
        const defer = new Deferred;

        const session = new NicoSession;
        const store = new SerializeCookieStore;
        const cookieJar = Request.jar(store);

        const nicoCookie = new ToughCookie.Cookie({
            key : "user_session",
            value : sessionId,
            domain : "nicovideo.jp",
            path : "/",
            httpOnly : false
        });

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
            }
            );

            return defer.resolve(session);
        });

        return defer.promise;
    },

    /**
     * ニコニコ動画のログインセッションを確立します。
     * @param {String}   user        ログインユーザーID
     * @param {String}   password    ログインパスワード
     * @return {Promise}
     */
    login(user, password) {
        const cookie = Request.jar(new SerializeCookieStore);

        return Request.post({
            resolveWithFullResponse : true,
            followAllRedirects      : true,
            url     : NicoUrl.Auth.LOGIN,
            jar     : cookie,
            form    : {
                mail_tel : user,
                password
            }}).then(res => {
            const defer = new Deferred;

            if (res.statusCode === 503) {
                defer.reject("Nicovideo has in maintenance.");
                return;
            }

            // try get cookie
            // console.log self._cookie
            cookie._jar.store
            .findCookie("nicovideo.jp", "/", "user_session", function(err, cookie) {
                if (cookie != null) {
                    defer.resolve(cookie.value);
                } else if (err != null) {
                    defer.reject("Authorize failed");
                } else {
                    defer.reject("Authorize failed (reason unknown)");
                }

            });

            return defer.promise;
        }).then(function(sessionId) {
            const session = new NicoSession;
            session.sessionId = sessionId;

            Object.defineProperties(session, {
                cookie : {
                    value : cookie
                },

                sessionId : {
                    configurable : true,
                    value : sessionId
                }
            }
            );

            return Promise.resolve(session);
        });
    }
};
