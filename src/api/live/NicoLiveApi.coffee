###*
# ニコニコ生放送APIラッパークラスエントランス
# TODO Manage LiveInfo and NsenChannel instances for support dispose.
###
NicoLiveInfo    = require "./NicoLiveInfo"
NicoLiveComment = require "./NicoLiveComment"
CommentProvider = require "./CommentProvider"
NsenChannel     = require "./NsenChannel"

DisposeHelper   = require "../../helper/disposeHelper"

class NicoLiveApi
    @CommentProvider    = CommentProvider
    @NicoLiveInfo       = NicoLiveInfo
    @NicoLiveComment    = NicoLiveComment
    @NsenChannel        = NsenChannel


    _session        : null

    _nsenChannelInstances   : null
    _nicoLiveInstances      : null

    ###*
    # @param {NicoSession} session NicoSession object
    ###
    constructor     : (session) ->
        @_session = session
        @_nsenChannelInstances  = []
        @_nicoLiveInstances     = []


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
        @_nicoLiveInstances.push liveInfo

        return dfr.promise


    ###*
    # NicoLiveInfoオブジェクトからNsenChannelのインスタンスを取得します。
    #
    # @param {NicoLiveInfo} liveInfo
    # @return {NsenChannel}
    ###
    getNsenChannelHandlerFor : (liveInfo) ->
        instance = new NsenChannel liveInfo
        @_nsenChannelInstances.push instance
        return instance


    ###*
    # 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
    ###
    dispose         : ->
        for instance in @_nsenChannelInstances
            instance.dispose();

        for instance in @_nicoLiveInstances
            instance.dispose();

        DisposeHelper.wrapAllMembers @


module.exports = NicoLiveApi
