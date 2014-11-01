###*
ニコニコ生放送APIラッパークラスエントランス
###
NicoLiveInfo    = require "./NicoLiveInfo"
NsenChannel     = require "./NsenChannel"

class NicoLiveApi

    ###*
    # @param {NicoAuthTicket}   Authenticated NicoAuthTicket object
    ###
    constructor     : (ticket) ->
        @_ticket = ticket


    _getTicket      : ->
        @_ticket

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

        return new NicoLiveInfo @, liveId


    ###*
    # NicoLiveInfoオブジェクトからNsenChannelのインスタンスを取得します。
    #
    # @param {NicoLiveInfo} liveInfo
    # @return {NsenChannel}
    ###
    getNsenChannelHandlerFor : (liveInfo) ->
        return new NsenChannel liveInfo


return NicoLiveAPI
