import * as QueryString from "querystring"
import * as Ent from "ent"
import APIEndpoints from "../APIEndpoints"
import NicoSession from '../NicoSession'
import NicoException from "../NicoException"
import {VideoMetaData} from '../Entity/VideoMetaData'

/**
 * 動画情報(NicoVideoInfo）を取得します。
 *
 * 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
 *
 * @param    {string}    movieId 情報を取得したい動画ID
 * @return   {Promise}
 * - resolve : (info: NicoVideoInfo)
 */
export const getVideoInfo = async (session: NicoSession, movieId: string): Promise<VideoMetaData> =>
{
    if (movieId == null) throw new NicoException({message: "Fetch failed. Movie id not specified."})

    // getThumbInfoの結果を取得
    const res = await APIEndpoints.video.getMovieInfo(session, {movieId})

    if (res.statusCode === 503) {
        throw new NicoException({message: "Nicovideo has in maintenance."});
    }

    return _parseVideoInfoResponse(res.body, movieId)
}

const _parseVideoInfoResponse = (resBody: string, movieId: string): VideoMetaData =>
{
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
 * getflv APIの結果を取得します。
 * @param {string} movieId
 */
export const getFlv = async (session: NicoSession, movieId: string): any =>
{
    const res = await APIEndpoints.video.getFlv(session, {movieId})
    return QueryString.parse(res.body)
}
