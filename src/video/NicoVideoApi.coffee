NicoVideoInfo   = require "./NicoVideoInfo"

###*
# ニコニコ動画APIへのアクセスを担当するクラス
# @class NicoVideoApi
###
class NicoVideoApi
    @NicoVideoInfo  = NicoVideoInfo

    ###*
    # @private
    # @property _session
    # @type NicoSession
    ###
    _session        : null

    ###*
    # @class NicoVideoApi
    # @param {NicoSession}      session
    ###
    constructor     : (@_session) ->

    ###*
    # 動画情報(NicoVideoInfo）を取得します。
    #
    # 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
    #
    # @param    {string}    movieId 情報を取得したい動画ID
    # @return   {Promise}
    # - resolve : (info: NicoVideoInfo)
    ###
    getVideoInfo    : (movieId) ->
        NicoVideoInfo.fetch movieId, @_session


module.exports = NicoVideoApi
