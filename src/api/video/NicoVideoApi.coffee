###*
# ニコニコ動画のAPIへのアクセスを担当します。
###

NicoVideoInfo   = require "./NicoVideoInfo"

class NicoVideoApi
    @NicoVideoInfo  = NicoVideoInfo

    _ticket     : null

    constructor : (ticket) ->
        @_ticket = ticket


    ###*
    # 動画情報(NicoVideoInfo）を取得します。
    #
    # 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
    #
    # @param    {string}    movieId 情報を取得したい動画ID
    # @return   {Promise}
    ###
    getVideoInfo = (movieId) ->
        dfd = Promise.defer()

        model = new NicoVideoInfo movieId

        model.fetch().then ->
            dfd.resolve model
            return
        , (msg) ->
            dfd.reject msg
            return

        return dfd.promise


module.exports = NicoVideoApi
