{Emitter} = require "event-kit"
cheerio = require "cheerio"
Request = require "request-promise"
ToughCookie = require "tough-cookie"
{SerializeCookieStore} = require "tough-cookie-serialize"
Deferred = require "promise-native-deferred"

NicoUrl = require "./NicoURL"
NicoException = require "./NicoException"
NicoLiveAPI = require "./live/NicoLiveApi"
NicoVideoAPI = require "./video/NicoVideoApi"
NicoMyListAPI = require "./mylist/NicoMyListApi"
NicoUserAPI = require "./user/NicoUserAPI"

class NicoSession
    @services : new WeakMap

    ###*
    # @property live
    # @type NicoLive
    ###

    ###*
    # @property video
    # @type NicoVideo
    ###

    ###*
    # @property mylist
    # @type NicoMyList
    ###

    ###*
    # @property sessionId
    # @type String
    ###

    ###*
    # @property cookie
    # @type request.CookieJar
    ###

    constructor : ->
        Object.defineProperties @,
            live    :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    store.live ?= new NicoLiveAPI @

            video   :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    store.video ?= new NicoVideoAPI @

            mylist  :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    store.mylist ?= new NicoMyListAPI @

            user    :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    store.user ?= new NicoUserAPI @

    ###*
    # 再ログインします。
    # @return {Promise}
    ###
    relogin : (user, password) ->
        Request.post
            resolveWithFullResponse : true
            followAllRedirects : true
            url : NicoUrl.Auth.LOGIN
            jar : @cookie
            form :
                mail_tel : user
                password : password
        .then (res) ->
            return Promise.reject("Nicovideo has in maintenance.") if res.statusCode is 503


    ###*
    # ログアウトします。
    # @method logout
    # @return {Promise}
    ###
    logout         : ->
        Request.post
            resolveWithFullResponse : true
            url : NicoUrl.Auth.LOGOUT
            jar : @cookie
        .then (res) =>
            return Promise.reject("Nicovideo has in maintenance.") if res.statusCode is 503


    ###*
    # セッションが有効であるか調べます。
    # @method isActive
    # @return {Promise}
    #   ネットワークエラー時にrejectされます
    # - Resolve: (state: Boolean)
    ###
    isActive        : ->
        # ログインしてないと使えないAPIを叩く
        Request.get
            resolveWithFullResponse : true
            url : NicoUrl.Auth.LOGINTEST
            jar : @cookie
        .then (res) ->
            $res = cheerio res.body
            $err = $res.find "error code"

            Promise.resolve($err.length is 0)

    toJSON : ->
        JSON.parse @cookie._jar.store.toString()


    ###*
    # このインスタンスを破棄します。
    # @method dispose
    ###

module.exports =
    ###*
    # @return {Promise}
    ###
    fromJSON : (object, user = null, password = null) ->
        defer = new Deferred

        store = new SerializeCookieStore()
        store.fromString(JSON.stringify(object))
        cookie = Request.jar(store)

        session = new NicoSession
        password? and Store.set(session, password)

        user? and Object.defineProperty session, "_user", {value : user}
        Object.defineProperty session, "cookie", {value : cookie}

        store.findCookie "nicovideo.jp", "/", "user_session", (err, cookie) ->
            return if err? or (not cookie?)
                defer.reject new NicoException
                    message : "Cookie 'user_session' not found."

            session._sessionId = cookie.value
            defer.resolve session

        defer.promise

    ###*
    # @method restoreFromSessionId
    # @param {String} sessionId
    ###
    fromSessionId : (sessionId) ->
        defer = new Deferred

        session = new NicoSession
        store = new SerializeCookieStore
        cookieJar = Request.jar store

        nicoCookie = new ToughCookie.Cookie
            key : "user_session"
            value : sessionId
            domain : "nicovideo.jp"
            path : "/"
            httpOnly : false

        store.putCookie nicoCookie, ->
            session.sessionId = sessionId

            Object.defineProperties session,
                _user :
                    value : null

                cookie :
                    value : cookieJar

                sessionId :
                    configurable : true
                    value : sessionId

            defer.resolve session

        defer.promise

    ###*
    # ニコニコ動画のログインセッションを確立します。
    # @param {String}   user        ログインユーザーID
    # @param {String}   password    ログインパスワード
    # @return {Promise}
    ###
    login : (user, password) ->
        cookie = Request.jar(new SerializeCookieStore)

        Request.post
            resolveWithFullResponse : true
            followAllRedirects      : true
            url     : NicoUrl.Auth.LOGIN
            jar     : cookie
            form    :
                mail_tel : user
                password : password
        .then (res) =>
            defer = new Deferred

            if res.statusCode is 503
                defer.reject "Nicovideo has in maintenance."
                return

            # try get cookie
            # console.log self._cookie
            cookie._jar.store
            .findCookie "nicovideo.jp", "/", "user_session", (err, cookie) ->
                if cookie?
                    defer.resolve cookie.value
                else if err?
                    defer.reject "Authorize failed"
                else
                    defer.reject "Authorize failed (reason unknown)"

                return

            defer.promise

        .then (sessionId) ->
            session = new NicoSession
            session.sessionId = sessionId

            Object.defineProperties session,
                cookie :
                    value : cookie

                sessionId :
                    configurable : true
                    value : sessionId

            Promise.resolve(session)
