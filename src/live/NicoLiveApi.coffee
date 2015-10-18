_ = require "lodash"
NicoLiveInfo = require "./NicoLiveInfo"
NsenChannels = require "./NsenChannels"
NsenChannel = require "./NsenChannel"


module.exports =
class NicoLiveApi
    _session        : null

    _nsenChannelInstances   : null
    _nicoLiveInstances      : null

    ###*
    # @param {NicoSession} _session
    ###
    constructor     : (@_session) ->
        @_nsenChannelInstances  = {}
        @_nicoLiveInstances     = {}

    ###*
    # 指定された放送の情報を取得します。
    #
    # 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
    # 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
    #
    # @param {string}   liveId  放送ID
    # @return {Promise}
    ###
    getLiveInfo     : (liveId) ->
        if typeof liveId isnt "string" or liveId is ""
            throw new TypeError("liveId must bea string")

        return Promise.resolve(@_nicoLiveInstances[liveId]) if @_nicoLiveInstances[liveId]?

        NicoLiveInfo.instanceFor(liveId, @_session)
        .then (liveInfo) =>
            @_nicoLiveInstances[liveId] = liveInfo
            Promise.resolve liveInfo


    ###*
    # NsenChannelのインスタンスを取得します。
    #
    # @param {String} channel
    # @param {Object} [options]
    # @param {Boolean} [options.connect=false] NsenChannel生成時にコメントサーバーへ自動接続するか指定します。
    # @param {Number} [options.firstGetComments] 接続時に取得するコメント数
    # @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
    # @return {Promise}
    ###
    getNsenChannelHandlerFor : (channel, options = {}) ->
        isValidChannel = _.select(NsenChannels, {'id': channel}).length is 1

        unless isValidChannel
            throw new RangeError("Invalid Nsen channel: #{channel}")

        return Promise.resolve(@_nsenChannelInstances[channel]) if @_nsenChannelInstances[channel]?

        @getLiveInfo(channel)
        .then (live) =>
            NsenChannel.instanceFor(live, options, @_session)

        .then (instance) =>
            @_nsenChannelInstances[channel] = instance
            instance.onWillDispose =>
                delete @_nsenChannelInstances[channel]

            Promise.resolve instance


    ###*
    # 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
    ###
    dispose         : ->
        for instance in @_nsenChannelInstances
            instance.dispose();

        for instance in @_nicoLiveInstances
            instance.dispose();

        DisposeHelper.wrapAllMembers @
