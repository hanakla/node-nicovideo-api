###*
# Properties
#  attrメソッドを介して取得します。（とりあえずマイリストの場合、属性は一切設定されません。）
#      Example: mylist.attr("id") // -> マイリストIDを取得
#  - id             : number    -- マイリストID
#  - name           : string    -- リスト名
#  - description    : string    -- マイリストの説明
#  - public         : boolean   -- 公開マイリストかどうか
#  - iconId         : number    -- マイリストのアイコンID
#  - defaultSort    : number    -- 標準のソート方法（？）
#  - sortOrder      : number    -- ソート方式（？）
#  - userId         : number    -- ユーザー番号
#  - createTime     : Date      -- マイリストの作成日
#  - updateTime     : Date      -- マイリストの更新日
###
_  = require "lodash"
{Emitter} = require "event-kit"
Request = require "request-promise"
{sprintf} = require("sprintf")
QueryString = require "querystring"

NicoUrl = require "../NicoURL"
MyListItem = require "./MyListItem"

module.exports =
class MyList extends Emitter
    @_cache : {}

    @_attr :
        id          : -1
        name        : null
        description : null
        public      : null

        iconId      : -1
        defaultSort : -1
        sortOrder   : -1
        userId      : -1

        createTime  : null
        updateTime  : null


    ###*
    # @param {MyListMeta}   myListMeta
    # @param {NicoSession}  session
    # @return Promise
    ###
    @instanceById : (myListMeta, session) ->
        id = myListMeta.id
        list = new MyList(myListMeta, session)

        return Promise.resolve(MyList._cache[id]) if MyList._cache[id]?
        list.fetch().then ->
            Promise.resolve list


    ###*
    # マイリストが最新の内容に更新された時に発火します
    # @event MyList#did-refresh
    # @property {MyList}    list
    ###

    ###*
    # マイリストから項目が削除された時に発火します
    # @event MyList#did-delete-item
    # @property {MyList}        list
    # @property {MyListItem}    item
    ###

    ###*
    # @private
    # @property {NicoSession} _session セッション
    ###
    _session : null

    ###*
    # @private
    # @property {Object} _urlSet MyList APIのurl
    ###
    _urlSet : null

    ###*
    # @private
    # @property {Object} _attr マイリスト情報
    ###
    _attr : null

    ###*
    # @property {Array.<MyListItem>} items 登録されている動画のリスト
    ###
    items : null

    ###
    # @param {MyListMeta}   metaInfo    操作対象の MyListMetaのインスタンス。
    # @param {NicoSession}  session     セッション
    ###
    constructor         : (metaInfo, @_session) ->
        @_attr = metaInfo.toJSON()
        @items = []

        Object.defineProperties @,
            id :
                get : -> metaInfo.get("id")
            _urlSet :
                value : if metaInfo.get("id") is "home" then NicoUrl.MyList.DefList else NicoUrl.MyList.Normal

    ###*
    # このマイリストが"とりあえずマイリスト"か調べます。
    # @return {boolean} とりあえずマイリストならtrueを返します。
    ###
    isDefaultList : ->
        return @id is "home"

    ###*
    # マイリストに登録されている動画を取得します。
    #
    # @fires MyList#refreshed
    # @return {Promise}
    ###
    fetch : (options) ->
        Request.get
            resolveWithFullResponse : true
            url     : sprintf(@_urlSet.LIST, @id)
            jar     : @_session.cookie
        .catch (err) ->
            Promise.reject sprintf("MyList[id:%s]: Failed to fetch contents (Connection error: %s)", id, err)

        .then (res) =>
            try
                json = JSON.parse res.body
            catch e
                return Promise.reject sprintf("MyList[id:%s]: Failed to response parsing as JSON", id)

            if json.status isnt "ok"
                return Promise.reject sprintf("MyList[id:%s]: Failed to fetch contents (unknown)", id)

            @items = []
            _.each json.mylistitem.reverse(), (item) =>
                m = MyListItem.fromApiResponse(item, @)
                @items.push m

            @emit "did-refresh", {list: @}

            return

    ###*
    # マイリストのメタ情報を取得します。
    # @param {string}   attr    取得する属性名
    ###
    attr                : (attr) ->
        return @_attr[attr]

    ###*
    # @private
    # @param {MyListItem|Array.<MyListItem>}    items
    ###
    _pickHavingItemIds : (items) ->
        items = [items] unless Array.isArray(items)
        validItems = _.select items, (item) -> item instanceof MyListItem
        havingItems = _.select items, "list", @
        havingItemIds = _.pluck havingItems, 'id'

    ###*
    # マイリストに動画を追加します。
    # @param {NicoVideoInfo|string} movie   追加する動画のNicoVideoInfoオブジェクトか動画ID
    # @param {string?}              desc    マイリストの動画メモの内容
    # @return {Promise}
    ###
    addMovie : (movie, desc = "") ->
        self    = this
        dfd     = Promise.defer()
        id      = null

        # movieが文字列じゃない上に、オブジェクトじゃないとか、idプロパティがない場合
        if not _.isString(movie) and movie.id?
            return Promise.reject "動画IDが正しくありません"
        else
            id = if _.isString(movie) then movie else movie.id

        req =
            item_type   : 0
            item_id     : id
            token       : null
            description : desc
            group_id    : @id

        @isDefaultList() and (delete req.group_id)

        #-- APIと通信
        # アクセストークンを取得
        @_session.mylist.fetchToken()
        .then (token) =>
            req.token = token

            Request.post
                resolveWithFullResponse : true
                url : @_urlSet.ADD
                jar : @_session.cookie
                form : req

        .then (res) =>
            try
                result = JSON.parse res.body
            catch e
                return Promise.reject "Mylist[%s]: Failed to add item (JSON parse error)"

            if result.status is "ok"
                Promise.resolve {response: json}
            else
                e = new Error(sprintf("MyList[%s]: Failed to add item (reason: %s)", @id, result.error.description))
                e.response = result
                Promise.reject e


    ###*
    # マイリストから項目を削除します。
    #
    # 渡されたアイテム内のこのリストの項目でないものは無視されます。
    #
    # @param {MyListItem|Array.<MyListItem>}    items   削除する項目の配列
    # @return {Promise} 成功した時に削除された項目数でresolveします。
    ###
    deleteItem : (items) ->
        itemIds = @_pickHavingItemIds(items)
        return Promise.resolve({response: null}) if itemIds.length is 0

        @_session.mylist.fetchToken()
        .then (token) =>
            req =
                group_id : @id
                "id_list[0]" : itemIds
                token : token

            delete req.group_id if @isDefaultList()

            Request.post
                resolveWithFullResponse : true
                url : @_urlSet.DELETE
                jar : @_session.cookie
                form : req

        .then (res) ->
            try
                result = JSON.parse res.body
            catch e
                return Promise.reject new Error("Mylist[%s]: Failed to delete item (JSON parse error)")

            if result.status is "ok"
                Promise.resolve {response: json}
            else
                e = new Error(sprintf("MyList[%s]: Failed to delete item (reason: %s)", @id, result.error.description))
                e.response = json
                Promise.reject e

    ###*
    # マイリストから別のマイリストへ項目を移動します。
    #
    # 渡された項目内のこのリストの項目でないものは無視されます。
    #
    # @param {MyListItem|Array.<MyListItem>}    items   移動する項目の配列
    # @param　{MyList}   targetMyList    移動先のマイリスト
    # @return {Promise}
    ###
    moveItem : (items, targetMyList) ->
        if targetMyList not instanceof MyList
            throw new TypeError("targetMyList must be instance of MyList")

        itemIds = @_pickHavingItemIds(items)
        return Promise.resolve({response: null}) if itemIds.length is 0

        @_session.mylist.fetchToken()
        .then (token) =>
            req =
                group_id : @id
                target_group_id : targetMyList.id
                "id_list[0]" : itemIds
                token : token

            delete req.group_id if @isDefaultList()

            Request.post
                resolveWithFullResponse : true
                url : @_urlSet.MOVE
                jar : @_session.cookie
                form : req

        .then (res) ->
            try
                result = JSON.parse res.body
            catch e
                return Promise.reject "Mylist[%s]: Failed to delete item (JSON parse error)"

            if result.status is "ok"
                Promise.resolve {response: json}
            else
                e = new Error(sprintf("MyList[%s]: Failed to delete item (reason: %s)", @id, result.error.description))
                e.response = result
                Promise.reject e
    #
    # Event Handlers
    #
    onDidRefresh : (listener) ->
        @on "did-refresh", listener

    onDidDeleteItem : (listener) ->
        @on "did-delete-item", listener
