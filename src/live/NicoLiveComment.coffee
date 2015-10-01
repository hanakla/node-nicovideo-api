###*
# ニコニコ生放送のコメント情報モデル。
# Backbone.Modelを継承しています。
#
# Methods
#  - NicoLiveComment.fromPlainXml(xml: string)
#       コメントサーバーのレスポンスからNicoLiveCommentインスタンスを生成します。
#
#  - isControl(): boolean
#       コメントが運営の制御コメントか判定します。
#  - isDistributorPost(): boolean
#       コメントが配信者のものか判定します。
#  - isMyPost(): boolean
#       コメントが自分で投稿したものか判定します。
#
# Properties
#  - threadId   : number  -- コメントサーバー内のスレッドID
#  - date       : Date    -- コメント投稿日時
#  - locale     : string  -- 投稿元国情報("ja-jp", "jp"など、詳細不明)
#  - command    : string  -- コメント投稿時に設定されたコマンド(184など)
#  - isMyPost   : boolean -- 自分で投稿したコメントか
#  - user                 -- 投稿したユーザー情報
#      - id             : number|string -- ユーザー番号(匿名コメントの場合は文字列）
#      - score          : number        -- このユーザーのNGスコア
#      - accountType    : number        -- アカウント種別(0:一般, 1:プレミアム, 3:配信者)
#      - isPremium      : boolean       -- プレミアム会員かどうか
#      - isAnonymous    : boolean       -- 匿名コメントかどうか
###
Backbone    = require "backbone"
cheerio     = require "cheerio"

REGEXP_LT = /</g
REGEXP_GT = />/g

noop = ->

class NicoLiveComment extends Backbone.Model
    ###*
    # 規定の形式のXMLからNicoLiveCommentモデルを生成します。
    #
    # ニコ生サーバーから配信されてくる以下のような形式のコメント（１行）を第１引数に渡してください。
    #   <chat thread="##" vpos="##" date="##" date_usec="##" user_id="##" premium="#" locale="**">コメント内容</chat>
    #
    # @param {string} xml ニコ生コメントサーバーから受信したXMLコメントデータ
    ###
    @fromRawXml     : (xml) ->
        $xml    = cheerio xml
        obj     =
            threadId: $xml.attr("thread")

            date    : new Date($xml.attr("date")|0 * 1000)
            locale  : $xml.attr("locale")
            command : $xml.attr("mail")
            comment : $xml.text().replace(REGEXP_GT, ">").replace(REGEXP_LT, "<")

            isMyPost: $xml.attr("yourpost") is "1"

            user    :
                id          : $xml.attr("user_id")
                score       : $xml.attr("score")|0
                accountType : $xml.attr("premium")|0
                isPremium   : ($xml.attr("premium")|0) > 0
                isAnonymous : $xml.attr("anonymity")|0 isnt 0

        # user.idを数値へ変換
        if obj.user.id and obj.user.id.match(/^[0-9]*$/)
            obj.user.id = obj.user.id | 0

        return new NicoLiveComment obj

    defaults :
        threadId: null,

        date    : null,
        locale  : null,
        command : null,
        comment : null,

        isMyPost: null,

        user    :
            id          : null,
            score       : 0,
            accountType : -1,
            isPremium   : false,
            isAnonymous : false

    isControl           : ->
        userid      = @get("user").id
        accountType = @get("user").accountType

        return (userid is 900000000) or (userid is 0) or (accountType is 6)


    isDistributorPost   : ->
        return @get("user").accountType is 3


    isMyPost            : ->
        return @get("isMyPost")

    parse   : noop
    fetch   : noop
    sync    : noop
    save    : noop
    destroy : noop


module.exports = NicoLiveComment
