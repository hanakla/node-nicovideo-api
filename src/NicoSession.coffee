{Emitter} = require "event-kit"
cheerio = require "cheerio"
Request = require "request-promise"

NicoUrl = require "./NicoURL"
NicoLiveAPI = require "./live/NicoLiveApi"
NicoVideoAPI = require "./video/NicoVideoApi"
NicoMyListAPI = require "./mylist/NicoMyListApi"

passwordStore = new WeakMap

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

    ###*
    # @private
    # @property _user
    # @type String
    ###


    ###*
    # 再ログインします。
    # @return {Promise}
    ###
    relogin : ->
        Request.post
            resolveWithFullResponse : true
            followAllRedirects      : true
            url     : NicoUrl.Auth.LOGIN
            jar     : @_cookie
            form    :
                mail_tel : user
                password : passwordStore.get(@)
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
            jar : @_cookie
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
            jar : @getCookieJar()
        , (res) ->
            $res = cheerio.load body
            $err = $res.find "error code"

            Promise.resolve($err.length is 0)


    ###*
    # このインスタンスを破棄します。
    # @method dispose
    ###

###*
# ニコニコ動画のログインセッションを確立します。
# @param {String}   user        ログインユーザーID
# @param {String}   password    ログインパスワード
# @return {Promise}
###
module.exports.login = (user, password) ->
    cookie = Request.jar()

    Request.post
        resolveWithFullResponse : true
        followAllRedirects      : true
        url     : NicoUrl.Auth.LOGIN
        jar     : cookie
        form    :
            mail_tel : user
            password : password
    .then (res) =>
        defer = Promise.defer()

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

        passwordStore.set(session, password)

        Object.defineProperties session,
            _user :
                value : user

            cookie :
                value : cookie

            sessionId :
                configurable : true
                value : sessionId

            live    :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    # store.live ?= new NicoLiveAPI @

            video   :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    # store.video ?= new NicoVideoAPI @

            mylist  :
                get     : ->
                    store = NicoSession.services.get(@)
                    store or NicoSession.services.set(@, store = {})
                    store.mylist ?= new NicoMyListAPI @

        Promise.resolve(session)
