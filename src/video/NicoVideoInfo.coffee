_  = require "lodash"
__ = require "lodash-deep"

Request = require "request-promise"
cheerio = require "cheerio"
{sprintf} = require("sprintf")
deepFreeze = require "deep-freeze"

NicoURL     = require "../NicoURL"
_instances  = {}


###*
# ニコニコ動画APIの動画情報モデルクラス
#
# Properties
#   getメソッドで第１階層まで取得できます。
#   Example: NicoVideoInfo.get("user").id
#
#
# @class NicoVideoInfo
# @extends EventEmitter2
###
module.exports =
class NicoVideoInfo
    @fetch : (movieId, session) ->
        defer = Promise.defer()
        return defer.reject "Fetch failed. Movie id not specified." unless movieId?

        # getThumbInfoの結果を取得
        request.get
            resolveWithFullResponse : true
            url : sprintf NicoURL.Video.GET_VIDEO_INFO, @_id
            jar : session.cookie
        .catch(defer.reject)
        .then  (res) ->
            if res.statusCode is 503
                defer.reject("Nicovideo has in maintenance.")

            info = new NicoVideoInfo
            info._id = movieId
            info.attributes = deepFreeze(NicoVideoInfo.parseResponse(res.body))

            defer.resolve(info)

        defer.promise

    ###*
    # @private
    # @param {String}   resBody     getThumbInfoAPIから取得したXML
    # @return {Object}
    ###
    @parseResponse : (resBody) ->
        $res = cheerio.load resBody

        if $res(":root").attr("status") isnt "ok"
            errCode = $res "error code"
            errMsg = $res("error description").text()
            # console.error "VideoInfo[%s]: 動画情報の取得に失敗しました。 (%s)", @id, errMsg

            return isDeleted: (errCode is "DELETED")


        $resThumb = $res "thumb"

        # 動画の秒単位の長さを出しておく
        length = do (length) ->
            length = $resThumb.find("length").text().split(":")
            s = length.pop() | 0
            m = length.pop() | 0
            h = length.pop() | 0
            return s + (m * 60) + (h * 3600)

        val =
            id          : $resThumb.find("video_id").text()
            title       : $resThumb.find("title").text()
            description : $resThumb.find("description").text()
            length      : length    # 秒数

            movieType   : $resThumb.find("movie_type").text()# "flv"とか
            thumbnail   : $resThumb.find("thumbnail_url").text()
            isDeleted   : false

            count       :
                view        : $resThumb.find("view_counter").text() | 0
                comments    : $resThumb.find("comment_num").text() | 0
                mylist      : $resThumb.find("mylist_counter").text() | 0

            tags        : do ->
                tags = []

                _.each $resThumb.find("tags"), (tags) ->
                    $tags = cheerio(tags)
                    domain = $tags.attr("domain")

                    _.each $tags.find("tag"), (tag) ->
                        $t = cheerio(tag)

                        tags.push
                            name        : $t.text()
                            isCategory  : $t.attr("category") is "1"
                            isLocked    : $t.attr("lock") is "1"
                            domain      : domain

                tags

                # _.map $resThumb.find("tags[domain='jp'] tag"), (tag) ->
                #     $t = cheerio(tag)
                #     return {
                #         name        : $t.text()
                #         isCategory  : $t.attr("category") is "1"
                #         isLocked    : $t.attr("lock") is "1"
                #         domain      : "jp"
                #     }

            user        :
                id          : $resThumb.find("user_id").text() | 0
                name        : $resThumb.find("user_nickname").text()
                icon        : $resThumb.find("user_icon_url").text()

        return val


    @defaults    :
        title           : null
        description     : null
        length          : null      # 秒数
        movieType       : null      # "flv", "mp4"
        thumbnail       : null
        isDeleted       : false
        count           :
            view            : -1
            comments        : -1
            mylist          : -1

        tags            : []        # {name:string, isCategory:boolean, isLocked:boolean}
        user            :
            id              :  -1
            name            : null
            icon            : null  # URL

    ###*
    # @private
    # @property _id
    # @type String
    ###
    _id         : null

    ###*
    # @property {Object}        attributes
    # @property {String}        attributes.id           動画ID
    # @property {String}        attributes.title        動画タイトル
    # @property {String}        attributes.description  動画説明文
    # @property {Number}        attributes.length       動画の長さ（秒）
    # @property {String}        attributes.movieType    動画ファイルの形式(mp4, flv, swf)
    # @property {String}        attributes.thumbnail    サムネイル画像のURL
    # @property {Boolean}       attributes.isDeleted    削除されているか（現在、常にfalse）
    # @property {Object}        attributes.stats        統計情報
    # @property {Number}        attributes.stats.view           再生数
    # @property {Object}        attributes.stats.comments       コメント数
    # @property {Object}        attributes.stats.mylist         マイリスト数
    # @property {Array<Object>} attributes.tags         タグ情報
    # @property {String}        attributes.tags[n].name         タグ名
    # @property {Boolean}       attributes.tags[n].isCategory   カテゴリタグか
    # @property {String}        attributes.tags[n].isLocked     ロックされているか
    # @property {String}        attributes.tags[n].domain       どの国のタグか（日本="jp"）
    # @property {Object}        attributes.user         投稿者情報
    # @property {Number}        attributes.user.id              ユーザーID
    # @property {String}        attributes.user.name            ユーザー名
    # @property {String}        attributes.user.icon            ユーザーアイコンのURL
    ###
    attributes  : {}

    ###*
    # @class NicoVideoInfo
    # @constructor
    # @param {String}       movieId     動画ID
    # @param {NicoSession}  session     セッション
    ###
    constructor     : (movieId, session) ->
        # 指定された動画の動画情報インスタンスがキャッシュされていればそれを返す
        # キャッシュに対応する動画情報インスタンスがなければ、新規作成してキャッシュ
        # return VideoInfo._cache[movieId] if VideoInfo._cache[movieId]?

        @_id = movieId
        @_session = session
        @attributes = _.cloneDeep(NicoVideoInfo.defaults)

        super

    ###*
    # 動画が削除されているか調べます。
    # @return {Boolean}
    ###
    isDeleted       : ->
      return @get "isDeleted"


    ###*
    # 属性を取得します。
    # @param {String}       path        属性名(Ex. "id", "title", "user.id")
    ###
    get             : (path) ->
        return __.deepGet @attributes, path
