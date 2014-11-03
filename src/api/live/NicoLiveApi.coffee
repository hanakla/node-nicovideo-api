###*
ニコニコ生放送APIラッパークラスエントランス
###
NicoLiveInfo    = require "./NicoLiveInfo"
NsenChannel     = require "./NsenChannel"

class NicoLiveApi
    @NsenChannel    = NsenChannel

    ###*
    # @param {NicoSession} session NicoSession object
    ###
    constructor     : (session) ->
        @_session = session


    _getSession     : ->
        @_session

    ###*
    # 指定された放送の情報を取得します。
    #
    # 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
    # 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
    #
    # @param    {string}   liveId  放送ID
    # @return   {Promise} Promiseオブジェクト
    ###
    getLiveInfo     : (liveId) ->

        if typeof liveId isnt "string" or liveId is ""
            throw new Error("liveIdは文字列である必要があります。")

        dfr         = Promise.defer()
        liveInfo    = new NicoLiveInfo @_session, liveId
        liveInfo.initThen ->
            dfr.resolve liveInfo

        return dfr.promise


    ###*
    # NicoLiveInfoオブジェクトからNsenChannelのインスタンスを取得します。
    #
    # @param {NicoLiveInfo} liveInfo
    # @return {NsenChannel}
    ###
    getNsenChannelHandlerFor : (liveInfo) ->
        return new NsenChannel liveInfo


module.exports = NicoLiveApi
