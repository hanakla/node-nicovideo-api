import * as cheerio from "cheerio"
import * as deepFreeze from "deep-freeze"
import * as Ent from "ent"

import APIEndpoints from "../APIEndpoints"
import NicoSession from '../NicoSession'
import NicoException from "../NicoException"

export interface NicoMovieMetadata {
    /** 動画ID */
    id: string
    /** 動画タイトル */
    title: string
    /** 動画説明文 */
    description: string

    /** 動画の長さ（秒） */
    length: number
    /** 動画ファイルの形式(mp4, flv, swf) */
    movieType: string
    /** サムネイル画像のURL */
    thumbnail: string
    /** 削除されているか（現在、常にfalse） */
    isDeleted: boolean

    /** 統計情報 */
    stats: {
        /** 再生数 */
        view: number
        /** コメント数 */
        comments: number
        /** マイリスト数 */
        mylist: number
    }

    /** タグ情報 */
    tags: {
        /** タグ名 */
        name: string
        /** カテゴリタグか */
        isCategory: boolean
        /** ロックされているか */
        isLocked: boolean
        /** どの国のタグか（日本="jp"） */
        domain: string
    }[]

    /** 投稿者情報 */
    user: {
        /** ユーザーID */
        id: number
        /** ユーザー名 */
        name: string
        /** ユーザーアイコンのURL */
        icon: string
    }
}

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
export default class NicoVideoInfo {
    private static defaults = {
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
    }

    public static async fetch(movieId: string, session: NicoSession) {
        if (movieId == null) throw new NicoException({message: "Fetch failed. Movie id not specified."})

        // getThumbInfoの結果を取得
        const res = await APIEndpoints.video.getMovieInfo(session, {movieId})

        if (res.statusCode === 503) {
            throw new NicoException({message: "Nicovideo has in maintenance."});
        }

        const info = new NicoVideoInfo(movieId, session);
        Object.defineProperty(info, 'metadata', deepFreeze(NicoVideoInfo._parseResponse(res.body, movieId)))

        return info
    }

    /**
     * @private
     * @param {String}   resBody     getThumbInfoAPIから取得したXML
     * @return {Object}
     */
    private static _parseResponse(resBody: string, movieId: string): NicoMovieMetadata {
        const $res = cheerio.load(resBody);

        if ($res(":root").attr("status") !== "ok") {
            const errorMessage = $res("error description").text();
            throw new NicoException({
                message : `Failed to fetch movie info (${errorMessage}) movie:${movieId}`,
                code    : +$res("error code")
            });
        }

        const $resThumb = $res("thumb");

        // 動画の秒単位の長さを出しておく
        const length = (() => {
            const length: string[] = $resThumb.find("length").text().split(":");
            const s = +length.pop()!;
            const m = +length.pop()!;
            const h = +length.pop()!;
            return s + (m * 60) + (h * 3600);
        })();

        return {
            id          : $resThumb.find("video_id").text(),
            title       : Ent.decode($resThumb.find("title").text()),
            description : $resThumb.find("description").text(),
            length,    // 秒数

            movieType   : $resThumb.find("movie_type").text(),// "flv"とか
            thumbnail   : $resThumb.find("thumbnail_url").text(),
            isDeleted   : false,

            stats       : {
                view        : +$resThumb.find("view_counter").text(),
                comments    : +$resThumb.find("comment_num").text(),
                mylist      : +$resThumb.find("mylist_counter").text()
            },

            tags        : (() => {
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
                id          : +$resThumb.find("user_id").text(),
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
    constructor(movieId: string, private _session: NicoSession) {
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

    public metadata: NicoMovieMetadata

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
}
