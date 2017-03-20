import {Emitter} from 'event-kit'
import cheerio from 'cheerio'
import {default as Request} from 'request-promise'
import {CookieJar} from 'request'
import ToughCookie from 'tough-cookie'
import {SerializeCookieStore} from 'tough-cookie-serialize'

import NicoUrl from './NicoURL'
import NicoException from './NicoException'
import NicoLiveAPI from './live/NicoLiveApi'
import NicoVideoAPI from './video/NicoVideoApi'
import NicoMyListAPI from './mylist/NicoMyListApi'
import NicoUserAPI from './user/NicoUserAPI'

class NicoSession {

    /**
     * @return {Promise}
     */
    static async fromJSON(object: object, user?: string, password?: string)
    {
        if (user == null) { user = null }
        if (password == null) { password = null }

        const store: any = new SerializeCookieStore()
        store.fromString(JSON.stringify(object))

        const cookie = Request.jar(store)

        const session = new NicoSession
        ;(password != null) && store.set(session, password)
        (user != null) && (session._userId =  user)
        session.cookie = cookie
        session.sessionId = await new Promise<string>((resolve, reject) => {
            store.findCookie("nicovideo.jp", "/", "user_session", (err, cookie) => {
                if (err != null || cookie == null) {
                    reject(new NicoException({message : "Cookie 'user_session' not found."}))
                }

                 resolve(cookie.value)
            })
        })

        return session
    }

    /**
     * @method restoreFromSessionId
     * @param {String} sessionId
     * @return {Promise}
     */
    static async fromSessionId(sessionId)
    {
        const session = new NicoSession
        const store = new SerializeCookieStore
        const cookieJar = Request.jar(store)

        const nicoCookie = new ToughCookie.Cookie({
            key : "user_session",
            value : sessionId,
            domain : "nicovideo.jp",
            path : "/",
            httpOnly : false
        })

        await new Promise(resolve => {
            store.putCookie(nicoCookie, () => {
                session.sessionId = sessionId
                session._userId = null
                session.cookie = cookieJar
                resolve()
            })
        })

        return session
    }

    /**
     * ニコニコ動画のログインセッションを確立します。
     * @param {String}   user        ログインユーザーID
     * @param {String}   password    ログインパスワード
     * @return {Promise}
     */
    static async login(user, password)
    {
        const cookie = Request.jar(new SerializeCookieStore)

        const res = await  Request.post({
            resolveWithFullResponse : true,
            followAllRedirects      : true,
            url     : NicoUrl.Auth.LOGIN,
            jar     : cookie,
            form    : {
                mail_tel : user,
                password
            }
        })

        if (res.statusCode === 503) {
            throw new NicoException({message: 'Nicovideo has in maintenance.'})
        }

        // try get cookie
        // console.log self._cookie
        const sessionId = await new Promise<string>((resolve, reject) => {
            cookie._jar.store.findCookie('nicovideo.jp', '/', 'user_session', function(err, cookie) {
                if (cookie != null) {
                    resolve(cookie.value)
                } else if (err != null) {
                    reject(new NicoException({message: `Authorize failed (${err})`}))
                } else {
                    reject(new NicoException({message: 'Authorize failed (reason unknown)'}))
                }
            })
        })

        const session = new NicoSession
        session.sessionId = sessionId

        Object.defineProperties(session, {
            cookie: {value: cookie},
            sessionId: {
                configurable : true,
                value : sessionId
            }
        })

        return session
    }

    private _liveApi: NicoLiveAPI

    private _videoApi: NicoVideoAPI

    private _mylistApi: NicoMyListAPI

    private _userApi: NicoUserAPI

    private _userId: string

    sessionId: string

    cookie: CookieJar

    /**
     * @property cookie
     * @type request.CookieJar
     */

    get live(): NicoLiveAPI
    {
        return this._liveApi = this._liveApi || new NicoLiveAPI(this)
    }

    get video(): NicoVideoAPI
    {
        return this._videoApi = this._videoApi || new NicoVideoAPI(this)
    }

    get mylist(): NicoMyListAPI
    {
        return this._mylistApi = this._mylistApi || new NicoMyListAPI(this)
    }

    get user(): NicoUserAPI
    {
        return this._userApi = this._userApi || new NicoUserAPI(this)
    }

    // private constructor() {}

    /**
     * 再ログインします。
     * @return {Promise}
     */
    async relogin(user, password): Promise<void>
    {
        const res = await Request.post({
            resolveWithFullResponse : true,
            followAllRedirects : true,
            url : NicoUrl.Auth.LOGIN,
            jar : this.cookie,
            form : {
                mail_tel : user,
                password
            }
        })


        if (res.statusCode === 503) {
            throw new NicoException({message: "Nicovideo has in maintenance."})
        }
    }


    /**
     * ログアウトします。
     * @method logout
     * @return {Promise}
     */
    async logout(): Promise<void>
    {
        const res = await Request.post({
            resolveWithFullResponse : true,
            url : NicoUrl.Auth.LOGOUT,
            jar : this.cookie
        })

        if (res.statusCode === 503) {
            throw new NicoException({message: "Nicovideo has in maintenance."})
        }
    }


    /**
     * セッションが有効であるか調べます。
     * @method isActive
     * @return {Promise}
     *   ネットワークエラー時にrejectされます
     * - Resolve: (state: Boolean)
     */
    async isActive(): Promise<boolean>
    {
        // ログインしてないと使えないAPIを叩く
        const res = await Request.get({
            resolveWithFullResponse : true,
            url : NicoUrl.Auth.LOGINTEST,
            jar : this.cookie
        })

        const $res = cheerio(res.body)
        const $err = $res.find("error code")

        return $err.length === 0
    }

    toJSON() {
        return JSON.parse(this.cookie._jar.store.toString())
    }
}