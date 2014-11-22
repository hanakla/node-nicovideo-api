###*
# ニコニコ動画のAPIへのアクセスを担当します。
###

NicoVideoInfo   = require "./NicoVideoInfo"
DisposeHelper   = require "../../helper/disposeHelper"

class NicoVideoApi
    @NicoVideoInfo  = NicoVideoInfo

    _session        : null

    constructor     : (session) ->
        @_session = session


    ###*
    # 動画情報(NicoVideoInfo）を取得します。
    #
    # 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
    #
    # @param    {string}    movieId 情報を取得したい動画ID
    # @return   {Promise}
    ###
    getVideoInfo    : (movieId) ->
        dfd = Promise.defer()

        model = new NicoVideoInfo movieId

        model.fetch().then ->
            dfd.resolve model
            return
        , (msg) ->
            dfd.reject msg
            return

        return dfd.promise


    ###*
    # 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
    ###
    dispose         : ->
        DisposeHelper.wrapAllMembers @


module.exports = NicoVideoApi
