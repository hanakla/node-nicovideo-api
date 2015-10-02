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
    # @return {Promise}
    ###
    getNsenChannelHandlerFor : (channel) ->
        isValidChannel = _.select(NsenChannels, {'id': channel}).length is 1

        unless isValidChannel
            throw new RangeError("Invalid Nsen channel: #{channel}")

        return Promise.resolve(@_nsenChannelInstances[channel]) if @_nsenChannelInstances[channel]?

        @getLiveInfo(channel).then (live) =>
            instance = new NsenChannel(live, @_session)
            @_nsenChannelInstances[channel] = instance
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
