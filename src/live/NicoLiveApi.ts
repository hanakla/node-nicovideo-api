import * as _ from "lodash";
import * as Cheerio from "cheerio";
import * as deepFreeze from "deep-freeze";

import APIEndpoints from "../APIEndpoints";
import NicoException from "../NicoException";
import NicoSession from "../NicoSession";
import NicoLiveInfo from "./NicoLiveInfo";
import { LiveMetaData } from "../Entity/LiveMetaData";
import {
  default as LiveSession,
  NicoLiveConnectPreference,
} from "./LiveSession";

export default class NicoLiveApi {
  private _nicoLiveInstances: { [liveId: string]: NicoLiveInfo } = {};

  /**
   * @param {NicoSession} _session
   */
  constructor(private _session: NicoSession) {}
}

/**
 * 指定された放送の情報を取得します。
 *
 * 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
 * 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
 *
 * @param {string}   liveId  放送ID
 * @return {Promise}
 */
export const getLiveInfo = async (
  session: NicoSession,
  liveId: string
): Promise<LiveMetaData> => {
  if (typeof liveId !== "string" || liveId === "") {
    throw new TypeError("liveId must bea string");
  }

  // if (this._nicoLiveInstances[liveId]) {
  //     return this._nicoLiveInstances[liveId]
  // }

  const res = await APIEndpoints.live.getPlayerStatus(session, { liveId });
  if (res.statusCode === 503) {
    throw new NicoException({
      message: `Live[${liveId}]: Nicovideo has in maintenance.`,
    });
  }

  return _parseLiveInfoResponse(res.body);
};

export const getLiveSession = async (
  session: NicoSession,
  liveId: LiveMetaData | string,
  options: Partial<NicoLiveConnectPreference> = {}
): Promise<LiveSession> => {
  const liveMeta: LiveMetaData =
    typeof liveId === "string" ? await getLiveInfo(session, liveId) : liveId;
  const liveSession = new LiveSession(session, liveMeta);

  if (options.connect) {
    await liveSession.connect(options);
  }

  return liveSession;
};

const _parseLiveInfoResponse = (responseBody: string): LiveMetaData => {
  const $res = Cheerio.load(res);
  const $root = $res(":root");
  const $stream = $res("stream");
  const $user = $res("user");
  const $rtmp = $res("rtmp");
  const $ms = $res("ms");

  if ($root.attr("status") !== "ok") {
    const errorCode = $res("error code").text();
    throw new NicoException({
      message: `Failed to parse live info (${errorCode})`,
      code: +errorCode,
      response: responseBody,
    });
  }

  const props: LiveMetaData = deepFreeze({
    stream: {
      liveId: $stream.find("id").text(),
      title: $stream.find("title").text(),
      description: $stream.find("description").text(),

      watchCount: $stream.find("watch_count").text() | 0,
      commentCount: $stream.find("comment_count") | 0,

      baseTime: new Date(($stream.find("base_time").text() | 0) * 1000),
      openTime: new Date(($stream.find("open_time").text() | 0) * 1000),
      startTime: new Date(($stream.find("start_time").text() | 0) * 1000),
      endTime: new Date(($stream.find("end_time") | 0) * 1000),

      isOfficial: $stream.find("provider_type").text() === "official",

      contents: _.map($stream.find("contents_list contents"), function (el) {
        let left, left1;
        const $content = Cheerio(el);
        return {
          id: $content.attr("id"),
          startTime: new Date(($content.attr("start_time") | 0) * 1000),
          disableAudio: ($content.attr("disableAudio") | 0) === 1,
          disableVideo: ($content.attr("disableVideo") | 0) === 1,
          duration:
            (left = $content.attr("duration") | 0) != null ? left : null, // ついてない時がある
          title: (left1 = $content.attr("title")) != null ? left1 : null, // ついてない時がある
          content: $content.text(),
        };
      }),
    },

    // 放送者情報
    owner: {
      userId: $stream.find("owner_id").text() | 0,
      name: $stream.find("owner_name").text(),
    },

    // ユーザー情報
    user: {
      id: $user.find("user_id").text() | 0,
      name: $user.find("nickname").text(),
      isPremium: $user.find("is_premium").text() === "1",
    },

    // RTMP情報
    rtmp: {
      isFms: $rtmp.attr("is_fms") === "1",
      port: $rtmp.attr("rtmpt_port") | 0,
      url: $rtmp.find("url").text(),
      ticket: $rtmp.find("ticket").text(),
    },

    // コメントサーバー情報
    comment: {
      addr: $ms.find("addr").text(),
      port: $ms.find("port").text() | 0,
      thread: $ms.find("thread").text() | 0,
    },

    // _hasError: $res("getplayerstatus").attr("status") !== "ok"
  });

  return props;
};
