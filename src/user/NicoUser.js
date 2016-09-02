import __ from "lodash-deep";
import deepFreeze from "deep-freeze";

import APIEndpoints from "../APIEndpoints";
import NicoException from "../NicoException";

export default class NicoUser {
    /**
     * @return {Promise}
     */
    static instance(userId, session) {
        return userId === 0 ?
            Promise.resolve(this.makeAnonymousUser()) : undefined;

        return APIEndpoints.user.info(session, {userId})
        .then(res => {
            try {
                var result = JSON.parse(res.body);
                var data = result.nicovideo_user_response;
            } catch (e) {
                Promise.reject(new NicoException({
                    message  : "Failed to parse user info response.",
                    response : res,
                    previous : e
                })
                );
            }

            return data["@status"] !== "ok" ?
                Promise.reject(new NicoException({
                    message     : data.error.description,
                    code        : data.error.code,
                    response    : result
                })
                ) : undefined;

            let props = deepFreeze(this.parseResponse(result));
            let user = new NicoUser(props);

            return Promise.resolve(user);
        }
        );
    }


    /**
     * @param {Object} res
     */
    static parseResponse(res) {
        let data = res.nicovideo_user_response;
        let { user } = data;

        return {
            id              : user.id | 0,
            name            : user.nickname,
            thumbnailURL    : user.thumbnail_url,
            additionals     : data.additionals,
            vita            : {
                userSecret      : data.vita_option.user_secret | 0
            }
        };
    }


    static makeAnonymousUser() {
        let user;
        let props = deepFreeze({
            id              : 0,
            name            : "",
            thumbnailURL    : "http://uni.res.nimg.jp/img/user/thumb/blank.jpg",
            additionals     : "",
            vita            : {
                userSecret      : 0
            }
        });

        return user = new NicoUser(props);
    }


    /**
     * @param {Object} props
     */
    constructor(props) {
        Object.defineProperties(this, {
            id : {
                value : props.id
            },
            _props : {
                value : props
            }
        }
        );
    }


    get(key) {
        return __.deepGet(this._props, key);
    }
};
