import _ from 'lodash';
import deepFreeze from 'deep-freeze';

import APIEndpoints from '../APIEndpoints';
import NicoException from '../NicoException';

export default class NicoUser {
    /**
     * @return {Promise}
     */
    static async instance(userId, session) {
        if (userId === 0 || ! userId) {
            return this.makeAnonymousUser();
        }

        const res = await APIEndpoints.User.info(session, {userId});
        let responseJson, userData;

        try {
            responseJson = JSON.parse(res.body);
            userData = responseJson.nicovideo_user_response;
        } catch (e) {
            Promise.reject(new NicoException({
                message  : 'Failed to parse user info response.',
                response : res,
                previous : e
            })
            );
        }

        if (userData['@status'] !== 'ok') {
            throw new NicoException({
                message     : userData.error.description,
                // code        : userData.error.code,
                response    : res
            });
        }

        const props = deepFreeze(this.parseResponse(responseJson));
        return new NicoUser(props);
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
        let props = deepFreeze({
            id              : 0,
            name            : '',
            thumbnailURL    : 'http://uni.res.nimg.jp/img/user/thumb/blank.jpg',
            additionals     : '',
            vita            : {
                userSecret      : 0
            }
        });

        return new NicoUser(props);
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
        return _.get(this._props, key);
    }
}
