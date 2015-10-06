QueryString = require "querystring"

NicoVideoInfo   = require "./NicoVideoInfo"
APIEndpoints = require "../APIEndpoints"

###*
# ニコニコ動画APIへのアクセスを担当するクラス
# @class NicoVideoApi
###
module.exports =
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

    ###*
    # getflv APIの結果を取得します。
    ###
    getFlv : (movieId) ->
        APIEndpoints.video.getFlv(@_session, {movieId}).then (res) ->
            Promise.resolve QueryString.parse res.body
