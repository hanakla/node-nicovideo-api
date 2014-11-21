#
# ニコニコ動画へのログイン/ログアウトと
# 認証状態の管理を行います。
# Events
#  - login:() -- ニコニコ動画へログインした時に発火します。
#  - logout:() -- ニコニコ動画からログアウトした時に発火します。
#

_           = require "lodash"
Backbone    = require "backbone"
cheerio     = require "cheerio"
request     = require "request"
sprintf     = require("sprintf").sprintf

NicoUrl     = require "./NicoURL"
DisposeHelper   = require "../helper/disposeHelper"

class NicoSession
    _.extend @::, Backbone.Events

    _user   : null
    _pass   : null

    _sessionKey : false

    _promise    : null

    _cookieJar : null

    constructor     : (user, password) ->
        @_user = user
        @_pass = password

        @_cookieJar = request.jar()

        @_login()


    _login          : ->
        if not @_user? or not @_pass?
            return

        self = @
        dfd = Promise.defer()
        @_promise = dfd.promise

        request
            .post
                url     : NicoUrl.Auth.LOGIN
                followAllRedirects  : true
                jar     : @_cookieJar
                form    :
                    mail_tel    : @_user
                    password    : @_pass

                , (err, resp, body) ->
                    if resp.statusCode is 503
                        dfd.reject "Nicovideo has in maintenance."
                        return

                    if err?
                        console.error err, NicoUrl.Auth.LOGIN
                        dfd.reject "Authorize failed by connection problem (#{err})"
                        return

                    # try get cookie
                    self._cookieJar._jar.store
                        .findCookie "nicovideo.jp", "/", "user_session", (err, cookie) ->
                            if cookie?
                                self._sessionKey = cookie.value
                                dfd.resolve self
                            else if err?
                                dfd.reject "Authorize failed"
                            else
                                dfd.reject "Authorize failed (reason unknown)"

                            return
                    return

        return dfd.promise

    _logout         : ->
        request
            .post
                url     : NicoUrl.Auth.LOGOUT
                jar     : @_jar


    isLogged        : ->
        return @_sessionKey isnt false


    isLogging        : ->
        dfd = Promise.defer()

        # ログインしてないと使えないAPIを叩く
        request
            .get
                url     : NicoUrl.Auth.LOGINTEST
                jar     : @getCookieJar()
                , (err, resp, resBody) ->
                    # 通信失敗
                    if err isnt null
                        dfd.reject err

                    # 通信成功
                    $res = cheerio resBody
                    $err = $res.find "error code"

                    # エラー情報がなければログイン済み
                    if $err.length is 0
                        dfd.resolve()
                    else
                        dfd.reject $err.text()

        return dfd.promise

    setSessionId    : (key) ->
        @_sessionKey = key
        @_promise = @isLogging()
        return


    getSessionId    : ->
        return @_sessionKey


    getCookieJar    : ->
        jar = request.jar()
        sessionId = @getSessionId()
        expireDate = new Date(Date.now() + (1000 * 60 * 60 * 24 * 31))
            .toGMTString()

        jar._jar.setCookieSync "user_session=#{sessionId}; expires=#{expireDate}; path=/; domain=.nicovideo.jp"
            , "http://www.nicovideo.jp/"
            , {}

        jar._jar.setCookieSync "user_session=#{sessionId}; expires=#{expireDate}; path=/; domain=live.nicovideo.jp"
            , "http://live.nicovideo.jp/"
            , {}

        return jar


    loginThen : (resolved, rejected) ->
        @_promise.then resolved, rejected
        return


    dispose         : ->
        @off()
        DisposeHelper.wrapAllMembers @


    module.exports = NicoSession
