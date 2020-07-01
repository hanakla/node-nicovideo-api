import * as deepFreeze from "deep-freeze";

import APIEndpoints from "../APIEndpoints";
import NicoException from "../NicoException";
import NicoSession from "../NicoSession";
import { UserData } from "../Entity/UserData";

export const getUserInfo = async (
  session: NicoSession,
  userId?: number | null
): Promise<UserData> => {
  if (!userId) {
    return makeAnonymousUser();
  }

  const res = await APIEndpoints.user.info(session, { userId });
  let result: any;
  let data: any;

  try {
    result = JSON.parse(res.body);
    data = result.nicovideo_user_response;
  } catch (e) {
    throw new NicoException({
      message: "Failed to parse user info response.",
      response: res,
      previous: e,
    });
  }

  if (data["@status"] !== "ok") {
    throw new NicoException({
      message: data.error.description,
      code: data.error.code,
      response: res,
    });
  }

  return deepFreeze(parseUserDataResponse(result));
};

const parseUserDataResponse = (res: any): UserData => {
  const data = res.nicovideo_user_response;
  const { user } = data;

  return {
    id: +user.id,
    name: user.nickname,
    thumbnailURL: user.thumbnail_url,
    additionals: data.additionals,
    vita: {
      userSecret: +data.vita_option.user_secret,
    },
  };
};

const makeAnonymousUser = (): UserData => {
  return deepFreeze({
    id: 0,
    name: "",
    thumbnailURL: "http://uni.res.nimg.jp/img/user/thumb/blank.jpg",
    additionals: "",
    vita: {
      userSecret: 0,
    },
  });
};
