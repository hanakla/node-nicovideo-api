###*
# ひとつのリストと対応する マイリストのインターフェースです。
# Backbone.Collectionを継承しています。
#
# Methods
#  - isDefaultList(): boolean
#       このリストが"とりあえずマイリスト"か判定します。
#  - attr(attr: string)
#       マイリストの属性（プロパティ）を取得します。
#  - add(movie: NicoVideoInfo|string)
#       マイリストに動画を追加します。
#       引数には動画IDを指定することができます。
#       (Backbone.Collection#addは実行されません。)
#
# Events
#  (Backbone.Collection で発生するイベント)
#
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

_                   = require "lodash"
Backbone            = require "backbone"
request             = require "request"
sprintf             = require("sprintf").sprintf

NicoUrl             = require "../NicoURL"
MyListItem          = require "./MyListItem"

_instances = {}


###*
# マイリストマイリストグループ（一つのリスト）のコレクションです。
# Backbone.Collectionを継承しています。
###
class MyList extends Backbone.Collection
    # デフォルトプロパティ
    _attributes :
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


    _urlSet     : null
    _mylistApi        : null

    ###
    # @param {MyListMeta} metaInfo 操作対象の MyListMetaのインスタンス。
    ###
    constructor         : (metaInfo) ->
        id = metaInfo.get("id")
        @_attributes = _.merge _.clone(@_attributes), metaInfo.toJSON()

        # 既存のインスタンスがあればそれを返す。
        if _instances[id]?
            return _instances[id]

        # 適切なAPIのURLを注入する
        this._urlSet = if this.isDefaultList() then NicoUrl.MyList.DefList else NicoUrl.MyList.Normal

        @_mylistApi = metaInfo._api

        Backbone.Collection.apply @


    initialize          : ->
        @fetch()


    # このマイリストが"とりあえずマイリスト"か検証します。
    # @return {boolean} とりあえずマイリストならtrueを返します。
    isDefaultList       : ->
        return @attr("id") is "default"


    ###*
    # マイリストのアイテムを取得します。
    # @return {Promise}
    ###
    fetch               : (options) ->
        self    = this
        dfd     = Promise.defer()
        id      = @attr("id")
        url     = null

        url = sprintf this._urlSet.LIST, id

        request.get
            url     : url
            jar     : @_mylistApi.getSession().getCookieJar()
            , (err, res, bodyJson) ->
                if err?
                    dfd.reject sprintf("MyList[id:%s]: Failed to fetch contents (Connection error: %s)", id, err)
                    return

                try
                    bodyJson = JSON.parse bodyJson
                catch e
                    dfd.reject sprintf("MyList[id:%s]: Failed to response parse as JSON", id);
                    return

                if bodyJson.status isnt "ok"
                    dfd.reject sprintf("MyList[id:%s]: Failed to fetch contents (unknown)", id)
                    return

                _.each bodyJson.mylistitem.reverse(), (item) ->
                    m = MyListItem.fromApiJson item
                    self.set m
                        , _.extend({merge: false}, options, {add: true, remove: false})

                dfd.resolve()

        return dfd.promise


    ###*
    # マイリストのメタ情報を取得します。
    # @param {string}   attr    取得する属性名
    ###
    attr                : (attr) ->
        return @_attributes[attr]


    ###*
    # マイリストに動画を追加します。
    # @param {NicoVideoInfo|string} movie   追加する、動画情報か動画ID
    # @param {string?}              desc    マイリストの動画メモの内容
    # @return {Promise} 動画の追加に成功すればresolve、失敗した時はエラーメッセージとともにrejectされます。
    ###
    add                 : (movie, desc = "") ->
        self    = this
        dfd     = Promise.defer()
        id      = null

        # movieが文字列じゃない上に、オブジェクトじゃないとか、idプロパティがない場合
        if not _.isString(movie) and movie.id?
            return Promise.reject "動画IDが正しくありません"
        else
            id = if _.isString(movie) then movie else movie.id

        # 送信データを準備
        data =
            item_type   : 0
            item_id     : id
            token       : null
            description : desc
            group_id    : @attr("id")

        # 不要なデータを削除
        this.isDefaultList() and (delete data.group_id)


        #-- APIと通信
        # アクセストークンを取得
        @_mylistApi.fetchToken()
            # 通信エラー
            .catch (err) ->
                dfd.reject error

            # 取得成功
            .then (token) ->
                data.token = token

                request.post
                    url     : self._urlSet.ADD
                    jar     : @_mylistApi.getSession().getCookieJar()
                    form    : data
                    json    : true
                    , (err, res, apiResult) ->
                        # APIの実行結果受信
                        if apiResult.status is "ok"
                            # APIを叩き終わったら最新の情報に更新
                            dfd.resolve()
                            self.fetch()
                        else
                            dfd.reject sprintf "MyList[%s]: Failed to add item (reason: %s)"
                                    , self.attr("id")
                                    , res.error.description

                        return

                #return $.ajax({url: self._urlSet.ADD, type:"POST", data:data, dataType:"json"})

        return dfd.promise


module.exports = MyList
