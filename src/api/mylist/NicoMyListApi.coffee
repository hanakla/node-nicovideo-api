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

MyListMeta  = require "./MyListMeta"
MyList      = require "./MyList"

# 一分以上経過したらトークンを取得する
FETCH_INTERVAL = 60 * 1000

# トークン抽出用パターン
TOKEN_REGEXP = /NicoAPI.token = "([0-9a-z\-]*)";/


class NicoMyListApi
    @MyListMeta     = MyListMeta
    @MyList         = MyList

    _ticket     : null

    _token      :
        timestamp   : null
        token       : null

    constructor : (ticket) ->
        @_ticket = ticket
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
            jar   : @_ticket.getCookieJar()
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
    getTicket   : ->
        return @_ticket


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
        lists   = []

        # 受信したデータからインデックスを作成

        request.get
            url   : NicoUrl.MyList.GET_GROUPS
            json  : true
        , (err, res, bodyJson) ->
            if err?
                # 通信エラー
                dfd.reject error
                return

            if bodyJson.status isnt "ok"
                dfd.reject "Failed to mylist fetch. (reason unknown)"
                return

            _.each res.mylistgroup, (group) ->
                lists.push new MyListMeta group, self
                return

            # とりあえずマイリストを取得
            if withoutDefList isnt true
                lists.push new MyListMeta null, self

            dfd.resolve lists
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
    fetchMyList = (id = "default") ->
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


    #
    #        if (_mylistGroups.groups && _mylistGroups.groups[id]) {
    #            return dfd.resolve(_mylistGroups.groups[id]).promise();
    #        }
    #
    #        if (["", "default", null, void 0].indexOf(id) !== -1) {
    #            return dfd.resolve(new MyListGroup()).promise();
    #        }
    #
    #        $.ajax({url:NicoUrl.MyList.GET_GROUPS, dataType:"json"})
    #            .done(function (res) {
    #                if (res.status !== "ok") {
    #                    dfd.reject("不明なエラー(API接続完了)");
    #                    return;
    #                }
    #
    #                // リストが初期化されていなければ初期化
    #                _mylistGroups.groups = _mylistGroups.groups || {};
    #
    #                var cache = _mylistGroups.groups,
    #                    groups = res.mylistgroup;
    #
    #                // 受信したデータからMyListGroupインスタンスを生成
    #                _.each(groups, function (group) {
    #                    if (group.id === id) {
    #                        cache[group.id] = new MyListGroup(group);
    #                    }
    #                });
    #
    #                if (_mylistGroups.groups[id]) {
    #                    dfd.resolve(_mylistGroups.groups[id]);
    #                } else {
    #                    dfd.reject("指定されたマイリストは見つかりませんでした。");
    #                }
    #            })
    #            .fail(function (jqxhr, status, error) {
    #                dfd.reject(error);
    #            });
    #

module.exports = NicoMyListApi
