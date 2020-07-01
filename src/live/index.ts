import NicoSession from "../NicoSession";
import { LiveMetaData } from "../Entity";
import cheerio from "cheerio";
import NicoException from "../NicoException";
import APIEndpoints from "../APIEndpoints";
import LiveSession, { NicoLiveConnectPreference } from "./LiveSession";
import deepFreeze from "deep-freeze";
import _ from "lodash";

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
  const $res = cheerio.load(responseBody);
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

      watchCount: parseInt($stream.find("watch_count").text(), 10),
      commentCount: parseInt($stream.find("comment_count").text(), 10),

      baseTime: new Date(parseInt($stream.find("base_time").text(), 10) * 1000),
      openTime: new Date(parseInt($stream.find("open_time").text(), 10) * 1000),
      startTime: new Date(
        parseInt($stream.find("start_time").text(), 10) * 1000
      ),
      endTime: new Date(parseInt($stream.find("end_time").text(), 10) * 1000),

      isOfficial: $stream.find("provider_type").text() === "official",

      contents: _.map($stream.find("contents_list contents"), (el) => {
        const $content = cheerio(el);

        // ついてない時がある
        const rawDuration = $content.attr("duration");
        const duration = rawDuration ? parseInt(rawDuration, 10) : null;

        return {
          id: $content.attr("id"),
          startTime: new Date(parseInt($content.attr("start_time"), 10) * 1000),
          disableAudio: parseInt($content.attr("disableAudio"), 10) === 1,
          disableVideo: parseInt($content.attr("disableVideo"), 10) === 1,
          duration,
          title: $content.attr("title") ?? null, // ついてない時がある
          content: $content.text(),
        };
      }),
    },

    // 放送者情報
    owner: {
      userId: $stream.find("owner_id").text(),
      name: $stream.find("owner_name").text(),
    },

    // ユーザー情報
    user: {
      id: $user.find("user_id").text(),
      name: $user.find("nickname").text(),
      isPremium: $user.find("is_premium").text() === "1",
    },

    // RTMP情報
    rtmp: {
      isFms: $rtmp.attr("is_fms") === "1",
      port: parseInt($rtmp.attr("rtmpt_port"), 10),
      url: $rtmp.find("url").text(),
      ticket: $rtmp.find("ticket").text(),
    },

    // コメントサーバー情報
    comment: {
      addr: $ms.find("addr").text(),
      port: parseInt($ms.find("port").text(), 10),
      thread: parseInt($ms.find("thread").text(), 10),
    },

    // _hasError: $res("getplayerstatus").attr("status") !== "ok"
  });

  return props;
};
