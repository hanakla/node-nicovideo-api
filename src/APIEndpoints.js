import Request from 'request-promise';
import {sprintf} from 'sprintf';

import NicoURL from './NicoURL';

const get = options => {
    options.resolveWithFullResponse = true;
    return Request.get(options);
};

const post = options => {
    options.resolveWithFullResponse = true;
    return Request.post(options);
};

export default {
    Auth : {
        login(cookie, {user, password}) {
            return post({
                followAllRedirects : true,
                url : NicoURL.Auth.LOGIN,
                jar : cookie,
                form : {
                    mail_tel : user,
                    password,
                },
            });
        },
        logout(cookie) {
            return post({
                followAllRedirects : true,
                url : NicoURL.Auth.LOGOUT,
                jar : cookie,
            });
        },
        activityCheck(cookie) {
            return get({
                url : NicoURL.Auth.LOGINTEST,
                jar : cookie,
            });
        },
    },

    video : {
        /**
         * @param {NicoSession} session
         * @param {String} options.movieId
         * @return {Promise}
         */
        getMovieInfo(session, {movieId}) {
            return get({
                url : NicoURL.Video.GET_VIDEO_INFO + movieId,
                jar : session.cookie
            });
        },

        /**
         * @param {NicoSession} session
         * @param {String} options.movieId
         * @return {Promise}
         */
        getFlv(session, {movieId}) {
            return get({
                url : NicoURL.Video.GETFLV + movieId,
                jar : session.cookie
            });
        }
    },

    live : {
        /**
         * @param {NicoSession}
         * @param {String} options.liveId
         */
        getPlayerStatus(session, {liveId}) {
            return get({
                url : NicoURL.Live.GET_PLAYER_STATUS + liveId,
                jar : session.cookie
            });
        }
    },

    Nsen : {
        /**
         * @param {NicoSession} session
         * @param {String} options.liveId     LiveID
         * @param {String} options.movieId    Request movie ID
         * @return {Promise}
         */
        request(session, {liveId, movieId}) {
            return get({
                url : NicoURL.Live.NSEN_REQUEST+`?v=${liveId}&id=${movieId}`,
                jar : session.cookie
            });
        },
                // form :
                //     v : liveId
                //     id : movieId

        /**
         * @param {NicoSession} session
         * @param {String} options.liveId LiveID
         * @return Promise
         */
        cancelRequest(session, {liveId}) {
            return get({
                url : NicoURL.Live.NSEN_REQUEST + `?v=${liveId}&mode=cancel`,
                jar : session.cookie
            });
        },
                // form :
                //     v : liveId
                //     mode : 'cancel'

        /**
         * @param {NicoSession} session
         * @param {String} options.liveId LiveID
         * @return Promise
         */
        syncRequest(session, {liveId}) {
            return get({
                url : NicoURL.Live.NSEN_REQUEST + `?v=${liveId}&mode=requesting`,
                jar : session.cookie
            });
        },
                // form :
                //     v : liveId
                //     mode : 'requesting'

        /**
         * @param {NicoSession} session
         * @param {String} options.liveId LiveID
         * @return Promise
         */
        sendGood(session, {liveId}) {
            return get({
                url : NicoURL.Live.NSEN_GOOD + `?v=${liveId}`,
                jar : session.cookie
            });
        },
                // form :
                //     v : liveId

        /**
         * @param {NicoSession} session
         * @param {String} options.liveId LiveID
         * @return Promise
         */
        sendSkip(session, {liveId}) {
            return get({
                url : NicoURL.Live.NSEN_SKIP + `?v=${liveId}`,
                jar : session.cookie
            });
        }
    },
                // form :
                //     v: liveId

    MyList: {
        fetchDefaultListItems(session) {
            return get({
                url: NicoURL.MyList.DefaultList.LIST,
                jar: session.cookie,
            });
        },

        fetchItems(session, mylistId) {
            return get({
                url: sprintf(NicoURL.MyList.Normal.LIST, mylistId),
                jar: session.cookie,
            });
        },

        addItem(session, payload) {
            return post({
                url : NicoURL.MyList.Normal.ADD,
                jar : session.cookie,
                form : payload,
            });
        },

        deleteItem(session, payload) {
            return post({
                url: NicoURL.MyList.Normal.DELETE,
                jar: session.cookie,
                form: payload,
            });
        },
    },

    User : {
        info(session, {userId}) {
            return get({
                url : NicoURL.User.INFO + `?__format=json&user_id=${userId}`,
                jar : session.cookie
            });
        }
    }
};
