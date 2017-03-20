let NicoVideoInfo;
const _  = require("lodash");
const __ = require("lodash-deep");

const Request = require("request-promise");
const cheerio = require("cheerio");
const {sprintf} = require("sprintf");
const deepFreeze = require("deep-freeze");
const Ent = require("ent");
const Deferred = require("promise-native-deferred");

const APIEndpoints = require("../APIEndpoints");
const NicoException = require("../NicoException");


/**
 * ニコニコ動画APIの動画情報モデルクラス
 *
 * Properties
 *   getメソッドで第１階層まで取得できます。
 *   Example: NicoVideoInfo.get("user").id
 *
 *
 * @class NicoVideoInfo
 * @extends EventEmitter2
 */
module.exports =
(NicoVideoInfo = (function() {
    NicoVideoInfo = class NicoVideoInfo {
        static initClass() {
    
    
            this.defaults     = {
                title           : null,
                description     : null,
                length          : null,      // 秒数
                movieType       : null,      // "flv", "mp4"
                thumbnail       : null,
                isDeleted       : false,
                count           : {
                    view            : -1,
                    comments        : -1,
                    mylist          : -1
                },
    
                tags            : [],        // {name:string, isCategory:boolean, isLocked:boolean}
                user            : {
                    id              :  -1,
                    name            : null,
                    icon            : null
                }  // URL
            };
    
            /**
             * @property id
             * @type String
             */
    
            /**
             * @property {Object}        attributes
             * @property {String}        attributes.id           動画ID
             * @property {String}        attributes.title        動画タイトル
             * @property {String}        attributes.description  動画説明文
             * @property {Number}        attributes.length       動画の長さ（秒）
             * @property {String}        attributes.movieType    動画ファイルの形式(mp4, flv, swf)
             * @property {String}        attributes.thumbnail    サムネイル画像のURL
             * @property {Boolean}       attributes.isDeleted    削除されているか（現在、常にfalse）
             * @property {Object}        attributes.stats        統計情報
             * @property {Number}        attributes.stats.view           再生数
             * @property {Object}        attributes.stats.comments       コメント数
             * @property {Object}        attributes.stats.mylist         マイリスト数
             * @property {Array<Object>} attributes.tags         タグ情報
             * @property {String}        attributes.tags[n].name         タグ名
             * @property {Boolean}       attributes.tags[n].isCategory   カテゴリタグか
             * @property {String}        attributes.tags[n].isLocked     ロックされているか
             * @property {String}        attributes.tags[n].domain       どの国のタグか（日本="jp"）
             * @property {Object}        attributes.user         投稿者情報
             * @property {Number}        attributes.user.id              ユーザーID
             * @property {String}        attributes.user.name            ユーザー名
             * @property {String}        attributes.user.icon            ユーザーアイコンのURL
             */
            this.prototype._attr  = {};
        }
        static fetch(movieId, session) {
            const defer = new Deferred;
            if (movieId == null) { return defer.reject("Fetch failed. Movie id not specified."); }

            // getThumbInfoの結果を取得
            APIEndpoints.video.getMovieInfo(session, {movieId})
            .then(function(res) {
                if (res.statusCode === 503) {
                    defer.reject("Nicovideo has in maintenance.");
                }

                const info = new NicoVideoInfo(movieId, session);
                info._attr = deepFreeze(NicoVideoInfo.parseResponse(res.body, movieId));

                return defer.resolve(info);
            });

            return defer.promise;
        }

        /**
         * @private
         * @param {String}   resBody     getThumbInfoAPIから取得したXML
         * @return {Object}
         */
        static parseResponse(resBody, movieId) {
            const $res = cheerio.load(resBody);

            if ($res(":root").attr("status") !== "ok") {
                const errorMessage = $res("error description").text();
                throw new NicoException({
                    message : `Failed to fetch movie info (${errorMessage}) movie:${movieId}`,
                    code    : $res("error code")
                });
            }

            const $resThumb = $res("thumb");

            // 動画の秒単位の長さを出しておく
            var length = (function(length) {
                length = $resThumb.find("length").text().split(":");
                const s = length.pop() | 0;
                const m = length.pop() | 0;
                const h = length.pop() | 0;
                return s + (m * 60) + (h * 3600);
            })(length);

            return {
                id          : $resThumb.find("video_id").text(),
                title       : Ent.decode($resThumb.find("title").text()),
                description : $resThumb.find("description").text(),
                length,    // 秒数

                movieType   : $resThumb.find("movie_type").text(),// "flv"とか
                thumbnail   : $resThumb.find("thumbnail_url").text(),
                isDeleted   : false,

                count       : {
                    view        : $resThumb.find("view_counter").text() | 0,
                    comments    : $resThumb.find("comment_num").text() | 0,
                    mylist      : $resThumb.find("mylist_counter").text() | 0
                },

                tags        : (function() {
                    const tagList = [];

                    for (let tags of Array.from($resThumb.find("tags"))) {
                        const $tags = cheerio(tags);
                        const domain = $tags.attr("domain");

                        for (let tag of Array.from($tags.find("tag"))) {
                            const $tag = cheerio(tag);
                            tagList.push({
                                name        : $tag.text(),
                                isCategory  : $tag.attr("category") === "1",
                                isLocked    : $tag.attr("lock") === "1",
                                domain
                            });
                        }
                    }

                    return tagList;
                })(),

                user        : {
                    id          : $resThumb.find("user_id").text() | 0,
                    name        : $resThumb.find("user_nickname").text(),
                    icon        : $resThumb.find("user_icon_url").text()
                }
            };
        }

        /**
         * @class NicoVideoInfo
         * @constructor
         * @param {String}       movieId     動画ID
         * @param {NicoSession} _session     セッション
         */
        constructor(movieId, _session) {
            // 指定された動画の動画情報インスタンスがキャッシュされていればそれを返す
            // キャッシュに対応する動画情報インスタンスがなければ、新規作成してキャッシュ
            // return VideoInfo._cache[movieId] if VideoInfo._cache[movieId]?

            // @_attr = _.cloneDeep(NicoVideoInfo.defaults)

            this._session = _session;
            Object.defineProperties(this, {
                id : {
                    value : movieId
                }
            }
            );
        }

        /**
         * 動画が削除されているか調べます。
         * @return {Boolean}
         */
        isDeleted() {
          return this.get("isDeleted");
      }

        /**
         * この動画のgetflv APIの結果を取得します。
         * @return {Promise}
         */
        fetchGetFlv() {
            return this._session.video.getFlv(this.id);
        }


        /**
         * 属性を取得します。
         * @param {String}       path        属性名(Ex. "id", "title", "user.id")
         */
        get(path) {
            return __.deepGet(this._attr, path);
        }
    };
    NicoVideoInfo.initClass();
    return NicoVideoInfo;
})());
