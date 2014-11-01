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

_           = require "lodash"
Backbone    = require "backbone"
sprintf     = require("sprintf").sprintf

ItemTypes =
    movie: 0
    seiga: 5


class MyListItem extends Backbone.Model
    @ItemTypes      : ItemTypes

    @fromApiJson    : (infoObj) ->
        return new MyListItem infoObj, parse: true


    defaults    :
        id          : -1
        type        : -1
        description : null
        createTime  : null
        updateTime  : null
        watch       : 0

        movie       : null


    parse       : (infoObj) ->
        item = infoObj.item_data

        result =
            id          : infoObj.item_id|0
            type        : infoObj.item_type|0
            description : infoObj.description
            watch       : infoObj.watch

            createTime  : new Date(infoObj.create_time * 1000)
            updateTime  : new Date(infoObj.update_time)

            movie       :
                id          : item.video_id

                title       : item.title
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

        return result


    fetch       : _.noop
    sync        : _.noop
    save        : _.noop
    destroy     : _.noop

module.exports =
    ItemTypes   : ItemTypes
    fromApiJson : MyListItem.fromApiJson
