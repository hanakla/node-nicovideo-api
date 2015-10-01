NicoSession     = require "./NicoSession"

module.exports.login = (user, password) ->
    ###*
    # ニコニコ動画へログインし、ハンドラを取得します。
    #
    # @static
    # @method login
    # @param {String}   user        ログインユーザーID
    # @param {String}   password    ログインパスワード
    # @return {Promise}
    ###
    NicoSession.login(user, password)
