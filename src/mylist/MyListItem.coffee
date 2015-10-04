###*
# マイリストの項目モデルです。
# Backbone.Modelを継承しています。
#
# Properties
#  getメソッドを通じて第１階層まで取得できます。
#  Example. mylistItem.get("movie").title
#
#  - id             : number    -- マイリスト項目ID
#  - type           : number    -- 項目の種類（動画、静画など）
#  - description    : string    -- マイリストコメント
#  - createTime     : Date      -- 追加日
#  - updateTime     : Date      -- 更新日（？）
#  - watch          : number    -- 不明
#  - movie          : Object    -- 動画情報
#      - id             : string    -- 動画ID
#      - title          : string    -- 動画タイトル
#      - length         : number    -- 動画の長さ（秒）
#      - thumbnail      : string    -- サムネイル画像のURL
#
#      - groupType      : string    -- 不明
#      - lastResponse   : string    -- 最近投稿されたコメントの一部
#      - isDeleted      : boolean   -- 削除されているか
#
#      - updateTime     : Date      -- この情報の最終更新日時（？）
#      - firtsRetrieve  : Date      -- 動画投稿日
#
#      - count                  -- カウンタ系の情報が詰められたオブジェクト
#          - view       : number    -- 再生数
#          - comments   : number    -- コメント数
#          - mylist     : number    -- マイリスト数
###

_ = require "lodash"
__ = require "lodash-deep"
Ent = require "ent"
Emitter = require "../Emitter"

sprintf = require("sprintf").sprintf
deepFreeze = require "deep-freeze"

###*
# マイリスト内のアイテムを表すクラスです。
# @class MyListItem
###
module.exports =
class MyListItem extends Emitter
    ###*
    # @static
    # @property {Object}    ItemTypes           アイテムの種類のリスト
    # @property {Number}    ItemTypes.movie     動画
    # @property {Number}    ItemTypes.seiga     静画
    ###
    @ItemTypes      : deepFreeze
        MOVIE : 0
        SEIGA : 5
        BOOK : 6
        BLOMAGA : 13

    @defaults       :
        id              : -1
        type            : -1
        description     : null
        createTime      : null
        updateTime      : null
        watch           : 0

        movie           : null

    ###*
    # MylistAPIの取得結果の一部からMyListItemのオブジェクトを生成します。
    # @static
    # @method fromApiJSON
    # @param {Object}   itemInfo
    # @param {MyList}   mylist
    ###
    @fromApiResponse : (itemInfo, mylist) ->
        item = new MyListItem
        item._attr = deepFreeze(MyListItem.parse itemInfo)
        item.list = mylist

        Object.defineProperties item,
            id :
                value : item.get("id") | 0


    @parse : (itemInfo) ->
        item = itemInfo.item_data

        attr =
            id          : itemInfo.item_id|0
            type        : itemInfo.item_type|0
            description : itemInfo.description
            watch       : itemInfo.watch

            createTime  : new Date(itemInfo.create_time * 1000)
            updateTime  : new Date(itemInfo.update_time)

            movie       :
                id          : item.video_id

                title       : Ent.decode(item.title)
                length      : item.length_seconds|0 # 秒数
                thumbnail   : item.thumbnail_url

                groupType       : item.group_type
                lastResponse    : item.last_res_body
                isDeleted       : item.deleted isnt "0"

                updateTime      : new Date(item.update_time * 1000)
                firtsRetrieve   : new Date(item.first_retrieve * 1000)

                count           :
                    view            : item.view_counter|0
                    comments        : item.num_res|0
                    mylist          : item.mylist_counter|0

        attr

    ###*
    # @private
    # @property {Object}    _attr
    ###

    ###*
    # @property {Number}    id
    ###

    ###*
    # @param {String}   path
    # @return
    ###
    get : (path) ->
        __.deepGet @_attr, path

    ###*
    # @return {Promise}
    ###
    delete : ->
        @list.deleteItem @

    ###*
    # @return {Boolean}
    ###
    isMovie : ->
        @get("type") is MyListItem.ItemTypes.MOVIE

    ###*
    # @return {Boolean}
    ###
    isSeiga : ->
        @get("type") is MyListItem.ItemTypes.SEIGA

    ###*
    # @return {Boolean}
    ###
    isBook : ->
        @get("type") is MyListItem.ItemTypes.BOOK

    ###*
    # @return {Boolean}
    ###
    isBlomaga : ->
        @get("type") is MyListItem.ItemTypes.BLOMAGA
