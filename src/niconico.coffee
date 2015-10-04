NicoSession = require "./NicoSession"
deepFreeze = require "deep-freeze"

module.exports =
    ###*
    # @return {Promise}
    ###
    restoreSession : (json) ->
        NicoSession.fromJSON(json)

    ###*
    # ニコニコ動画へログインし、セッションを取得します。
    #
    # @static
    # @method login
    # @param {String}   user        ログインユーザーID
    # @param {String}   password    ログインパスワード
    # @return {Promise}
    ###
    login : (user, password) ->
        NicoSession.login(user, password)


    Nsen : deepFreeze
        RequestError  :
            NO_LOGIN        : "not_login"
            CLOSED          : "nsen_close"
            REQUIRED_TAG    : "nsen_tag"
            TOO_LONG        : "nsen_long"
            REQUESTED       : "nsen_requested"

        Gage :
            BLUE    : 0
            GREEN   : 1
            YELLOW  : 2
            ORANGE  : 3
            RED     : 4
