#jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, expr: true

###*
# ニコニコ動画APIの動画情報モデルクラス
#
# Properties
#   getメソッドで第１階層まで取得できます。
#   Example: NicoVideoInfo.get("user").id
#
#   - id            : string    -- 動画ID
#   - title         : string    -- 動画タイトル
#   - description   : string    -- 動画説明文
#   - length        : number    -- 動画の長さ（秒）
#   - movieType     : string    -- 動画のファイル種別(mp4, flv, swf)
#   - thumbnail     : string    -- サムネイル画像のURL
#
#   - count                     -- カウンタ系の情報が詰められたオブジェクト
#       - view          : number    -- 再生数
#       - comments      : number    -- コメント数
#       - mylist        : number    -- マイリスト数
#
#   - tags          : Array     -- 動画に設定されたタグ情報の配列
#       {name: string, isCategory: boolean, isLocked: boolean}
#       - name          : string    -- タグ名
#       - isCategory    : boolean   -- カテゴリタグか
#       - isLocked      : boolean   -- ロックされているか

#   - user                      -- 投稿者情報
#       - id            : number    -- ユーザーID
#       - name          : string    -- ユーザー名
#       - icon          : string    -- ユーザーアイコンURL
# Events
#   - sync: (model: VideoInfo)
#       動画情報が同期された時に発火します。
#   - change:(model: VideoInfo, options: Object)
#       動画情報が更新された時に発火します。
#   - "change:[attribute]": (model: VideoInfo, value:Object, options:Object)
#       [attribute]に指定されたプロパティが変更された時に発火します。
#   - error:(model: VideoInfo)
#       同期に失敗した時に発火します。
###

_           = require "lodash"
Backbone    = require "backbone"
request     = require "request"

Global = require("utils/Global")
NicoURL     = require("../NicoURL")
_instances  = {}



class VideoInfo extends Backbone.Model
    @_cache     : {}


    ###*
    # オブジェクトがNicoVideoInfoのインスタンスか検証します。
    # @param {Object} obj
    ###
    @isInstance : (obj) ->
        return obj instanceof VideoInfo


    defaults    :
      title         : null
      description   : null
      length        : null      # 秒数
      movieType     : null      # "flv", "mp4"
      thumbnail     : null
      isDeleted     : false
      count         :
        view            : -1
        comments        : -1
        mylist          : -1

      tags          : []        # {name:string, isCategory:boolean, isLocked:boolean}
      user          :
        id              :  -1
        name            : null
        icon            : null  # URL


    constructor     : (movieId) ->
        # 指定された動画の動画情報インスタンスがキャッシュされていればそれを返す
        # キャッシュに対応する動画情報インスタンスがなければ、新規作成してキャッシュ
        return VideoInfo._cache[videoId] if VideoInfo._cache[videoId]?

        super id: movieId

        @fetch()


    isValid         : ->
      return @get("_isValid") is true


    isDeleted       : ->
      return @get "isDeleted"


    fetch           : () ->
        if not @id?
            console.error "[VideoInfo] Fetch failed. Movie id not specified."
            return Promise.reject "Fetch failed. Movie id not specified."

        self = this
        dfd = Promise.defer()

        # getThumbInfoの結果を取得
        request.get
            url     : NicoURL.Video.GET_VIDEO_INFO + @id
            , (err, res, body) ->
                if err?
                    console.error "VideoInfo[id:%s]: Failed to fetch movie info.", self.id

                    if res.statusCode is 503
                        dfd.reject sprintf "VideoInfo[id:%s]: Nicovideo has in maintenance.", self.id
                    else
                        dfd.reject err
                        self.trigger "error"
                    return

                self.set self.parse(res)

                dfd.resolve()
                self.trigger "sync", self
                return

        return dfd.promise

    parse: (res) ->
        $res = $(res)
        length = 0
        val = undefined

        if $res.find(":root").attr("status") isnt "ok"
            errCode = $res.find("error code")
            console.error "MovieInfo: 動画情報の取得に失敗しました。 (%s)", $res.find("error description")
            return isDeleted: errCode is "DELETED"

        $res = $res.find("thumb")

        # 動画の秒単位の長さを出しておく
        length = ((length) ->
            length = length.split(":")
            s = length.pop() | 0
            m = length.pop() | 0
            h = length.pop() | 0
            s + (m * 60) + (h * 3600)
        ) $res.find("length").text()

        val =
            id          : $res.find("video_id").text()
            title       : $res.find("title").text()
            description : $res.find("description").text()
            length      : length    # 秒数

            movieType   : $res.find("movie_type").text()# "flv"とか
            thumbnail   : $res.find("thumbnail_url").text()
            isDeleted   : false
            count       :
                view        : $res.find("view_counter").text() | 0
                comments    : $res.find("comment_num").text() | 0
                mylist      : $res.find("mylist_counter").text() | 0

            tags    : _.map $res.find("tags[domain='jp'] tag"), (tag) ->
                $t = $(tag)
                return {
                    name        : $t.text()
                    isCategory  : $t.attr("category") is "1"
                    isLocked    : $t.attr("lock") is "1"
                }

            user        :
                id          : $res.find("user_id").text() | 0
                name        : $res.find("user_nickname").text()
                icon        : $res.find("user_icon_url").text()

        _isValid: true

        return val

    sync    : _.noop
    save    : _.noop
    destroy : _.noop

module.exports = VideoInfo
