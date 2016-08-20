_ = require "lodash"
Request = require "request-promise"
Deferred = require "promise-native-deferred"

NicoUrl     = require "../NicoURL"
MyListMeta  = require "./MyListMeta"
MyList      = require "./MyList"

# 30秒以上経過したらトークンを取得する
FETCH_INTERVAL = 30 * 1000

# トークン抽出用パターン
tokenRegexp = /NicoAPI.token = "([0-9a-z\-]*)";/


###*
# ニコニコ動画のマイリスト操作APIのラッピングを行います。
# （参考: http://efcl.info/wiki/niconicoapi/）
#
# @TODO Manage MyList instances for support dispose.
# @class NicoMyListApi
###
module.exports =
class NicoMyListApi
    ###*
    # @private
    # @property {NicoSession} _session
    ###

    ###*
    # 認証トークン
    # @private
    # @property {Object} _token
    # @property {Number} _token.timestamp   トークンを取得した時間（ミリ秒）
    # @property {String} _token.token       マイリスト操作用トークン
    ###


    ###*
    # @constructor
    # @class NicoMyListApi
    # @param {NicoSession}      session
    ###
    constructor : (@_session) ->
        @_token =
            timestamp   : null
            token       : null


    ###*
    # マイリストを操作するための認証トークンを取得します。
    # @method fetchToken
    # @return {Promise}
    ###
    fetchToken : ->
        # 一定時間以内に取得したトークンがあればそれを返す
        if @_token.token? and (Date.now() - @_token.timestamp) < FETCH_INTERVAL
            return Promise.resolve @_token.token

        # トークン取得
        Request.get
            resolveWithFullResponse : true
            url : NicoUrl.MyList.FETCH_TOKEN
            jar : @_session.cookie
        .then (res) =>
            # データを取得したらトークンを取り出す
            token = tokenRegexp.exec res.body

            if token[1]?
                @_token.timestamp = Date.now()
                @_token.token = token[1]

                Promise.resolve token[1]
            else
                Promise.reject "NicoMyListApi: Failed to pick token."


    ###*
    # マイリストの一覧を取得します。
    # @method fetchMyListsIndex
    # @param    {boolean} withoutHome
    #   trueを指定すると"とりあえずマイリスト"を一覧から除外します。
    # @return   {Promise}
    # - resolve : (mylists: Array.<MyListItemIndex>)
    # - reject : (message: String)
    ###
    fetchOwnedListIndex : (withoutHome = false) ->
        # 受信したデータからインデックスを作成
        Request.get
            resolveWithFullResponse : true
            url   : NicoUrl.MyList.GET_GROUPS
            jar   : @_session.cookie
        .then (res) ->
            try
                result  = JSON.parse res.body
                lists   = []

                if result.status isnt "ok"
                    return Promise.reject "Failed to fetch mylist. (reason unknown)"

                # とりあえずマイリスト
                if withoutHome is false
                    lists.push MyListMeta.instance("home")

                _.each result.mylistgroup, (group) =>
                    lists.push MyListMeta.instance(group)
                    return

                return Promise.resolve lists
            catch e
                return Promise.reject "Failed to fetch mylist. (#{e.message})"


    ###*
    # MyListインスタンスを取得します。
    # @method fetchMyList
    # @param    {MyListItemIndex|number} id
    #   MyListItemIndexかマイリストIDを渡します。
    # @return   {Promise(MyList, string)}
    #   取得できればMyListオブジェクトと共にresolveされ、
    #   そうでなければエラーメッセージと共にrejectされます
    ###
    getHandlerFor : (id = "home") ->
        new Promise (resolve, reject) =>
            if id instanceof MyListMeta
                resolve(MyList.instanceById(id, @_session))
                return

            id = (id | 0) if id isnt "home"

            @fetchOwnedListIndex(false).then (metaList) =>
                meta = _.where metaList, {id}

                if meta.length is 0
                    reject "Can't find specified mylist.(#{id})"
                else
                    resolve(MyList.instanceById(meta[0], @_session))

            return

        .then (mylist) =>
            defer = new Deferred
            mylist.fetch().then((-> defer.resolve(mylist)), defer.reject)
            defer.promise
