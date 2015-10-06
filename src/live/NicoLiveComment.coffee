###*
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
_ = require "lodash"
__ = require "lodash-deep"
Cheerio = require "cheerio"
deepFreeze = require "deep-freeze"

REGEXP_LT = /</g
REGEXP_GT = />/g


class NicoLiveComment
    @AccountTypes : deepFreeze
        GENERAL : 0
        PREMIUM : 1
        DISTRIBUTOR : 3
        ADMIN : 6

    # @defaults :
    #     threadId: null,
    #
    #     date    : null,
    #     locale  : null,
    #     command : null,
    #     comment : null,
    #
    #     isMyPost: null,
    #
    #     user    :
    #         id          : null,
    #         score       : 0,
    #         accountType : -1,
    #         isPremium   : false,
    #         isAnonymous : false

    ###*
    # 規定の形式のXMLからNicoLiveCommentモデルを生成します。
    #
    # ニコ生サーバーから配信されてくる以下のような形式のコメント（１行）を第１引数に渡してください。
    #   <chat thread="##" vpos="##" date="##" date_usec="##" user_id="##" premium="#" locale="**">コメント内容</chat>
    #
    # @param {String} xml ニコ生コメントサーバーから受信したXMLコメントデータ
    # @param {Number} loggedUserId 現在ログイン中のユーザーのID
    # @return {NicoLiveComment}
    ###
    @fromRawXml     : (xml, loggedUserId) ->
        $xml    = Cheerio xml
        props     =
            threadId: $xml.attr("thread")

            date    : new Date($xml.attr("date") * 1000)
            locale  : $xml.attr("locale")
            command : $xml.attr("mail")
            comment : $xml.text().replace(REGEXP_GT, ">").replace(REGEXP_LT, "<")
            vpos    : $xml.attr("vpos")|0

            isMyPost: ($xml.attr("yourpost") is "1" or (($xml.attr("user_id")|0) is loggedUserId))

            user    :
                id          : if _.isNaN(parseInt(ref = $xml.attr("user_id"), 10)) then ref else (ref | 0)
                score       : $xml.attr("score")|0
                accountType : $xml.attr("premium")|0
                isPremium   : ($xml.attr("premium")|0) > 0
                isAnonymous : $xml.attr("anonymity")|0 isnt 0

        new NicoLiveComment(props)


    constructor : (@_attr) ->
        Object.defineProperties @,
            command :
                value : @get("command")
            comment :
                value : @get("comment")


    get : (path) ->
        __.deepGet @_attr, path


    isNormalComment : ->
        not (@isControlComment() and @isPostByDistributor())


    isControlComment : ->
        userid      = @get("user.id")
        accountType = @get("user.accountType")

        (userid is 900000000) or (accountType is NicoLiveComment.AccountTypes.ADMIN)


    isPostByDistributor : ->
        @get("user.accountType") is NicoLiveComment.AccountTypes.DISTRIBUTOR


    isPostBySelf : ->
        @get("isMyPost")


    isPostByAnonymous : ->
        @get("user.isAnonymous")


    isPostByPremiumUser : ->
        @get("user.isPremium")


module.exports = NicoLiveComment
