###*
# ニコニコ動画のマイリスト操作APIのラッピングを行います。
# （参考: http://efcl.info/wiki/niconicoapi/）
#
# Methods
# - fetchListsIndex(withoutDefList: boolean?): Promise
#       マイリストの一覧情報を取得します。
#
#       withoutDefListにtrueを指定すると"とりあえずマイリスト"を一覧から除外します。
#       取得に成功したら{Array.<MyListItemIndex>}をresolveし、
#       失敗した時はエラーメッセージとともにrejectされます。
#
# - fetchMyList(id: MyListItemIndex|number?): Promise
#       指定されたMyListItemIndexまたはidと対応する、MyListインスタンスを取得します。
#       取得できればMyListオブジェクトと共にresolveされ、
#       そうでなければエラーメッセージと共にrejectされます
#
# Events
#   (none)
#
# Properties
#   (none)
###
_           = require "lodash"
request     = require "request"

NicoUrl     = require "../NicoURL"
MyListMeta  = require "./MyListMeta"
MyList      = require "./MyList"

# 一分以上経過したらトークンを取得する
FETCH_INTERVAL = 60 * 1000

# トークン抽出用パターン
TOKEN_REGEXP = /NicoAPI.token = "([0-9a-z\-]*)";/


class NicoMyListApi
    @MyListMeta     = MyListMeta
    @MyList         = MyList

    _session     : null

    _token      :
        timestamp   : null
        token       : null

    constructor : (session) ->
        @_session = session
        @_token = _.clone @_token


    ###*
    # マイリストを操作するためのトークンを取得します。
    # @return {Promise}
    ###
    fetchToken         : ->
        # 一定時間以内に取得したトークンがあればそれを返す
        if _token.token? and (Date.now() - _token.timestamp) < FETCH_INTERVAL
            return Promise.resolve _token.token

        # トークン取得
        dfd = Promise.defer()

        # 何故か取り出せない
        request.get
            url   : NicoUrl.MyList.FETCH_TOKEN
            jar   : @_session.getCookieJar()
            , (err, res, body) ->
                # 通信エラー
                if err?
                    dfd.reject "NicoMyListApi: #{err}"
                    return

                # データを取得したらトークンを取り出す
                token = TOKEN_REGEXP.exec body

                if token[1]?
                    @_token.timestamp = Date.now()
                    @_token.token = token[1]

                    dfd.resolve token[1]
                else
                    dfd.reject "NicoMyListApi: Failed to pick token."
                    return

        return dfd.promise


    ###*
    # 割り当てられている認証チケットを取得します。
    ###
    getSession      : ->
        return @_session


    ###*
    # マイリストの簡略な一覧情報を取得します。
    # @param    {boolean} withoutDefList
    #   trueを指定すると"とりあえずマイリスト"を一覧から除外します。
    # @return   {Promise}
    #   取得に成功したら{Array.<MyListItemIndex>}をresolveします。
    #   失敗した時はエラーメッセージとともにrejectされます。
    ###
    fetchMyListsIndex     : (withoutDefList = false) ->
        self    = @
        dfd     = Promise.defer()

        # 受信したデータからインデックスを作成
        request.get
            url   : NicoUrl.MyList.GET_GROUPS
            jar   : @_session.getCookieJar()
        , (err, res, body) ->
            if err?
                # 通信エラー
                dfd.reject error
                return

            try
                result  = JSON.parse body
                lists   = []

                if result.status isnt "ok"
                    dfd.reject "Failed to mylist fetch. (reason unknown)"
                    return

                _.each result.mylistgroup, (group) ->
                    lists.push new MyListMeta group, self
                    return

                # とりあえずマイリストを取得
                if withoutDefList isnt true
                    lists.push new MyListMeta null, self

                dfd.resolve lists

            catch e
                dfd.reject "Failed to mylist fetch. (#{e.message})"

            return

        return dfd.promise


    ###*
    # MyListインスタンスを取得します。
    #
    # @param    {MyListItemIndex|number} id
    #   MyListItemIndexかマイリストIDを渡します。
    # @return   {Promise(MyList, string)}
    #   取得できればMyListオブジェクトと共にresolveされ、
    #   そうでなければエラーメッセージと共にrejectされます
    ###
    fetchMyList     : (id = "default") ->
        dfd = Promise.defer()
        getInstanceDfd = Promise.defer()

        if id instanceof MyListMeta
            getInstanceDfd.resolve new MyList id
        else
            if id isnt "default"
                id = id | 0

            @getMyListIndex().then (groups) ->
                _.each groups, (obj) ->
                    # マイリストIDを元にインスタンスを取得
                    if obj.id is id
                        getInstanceDfd.resolve new MyList obj
                        return false

                getInstanceDfd.reject "Can't find specified mylist."
                return

        getInstanceDfd.then (instance) ->
            instance.fetch().then ->
                dfd.resolve instance
                return
            , (msg) ->
                dfd.reject msg
                return

        return dfd.promise



module.exports = NicoMyListApi
