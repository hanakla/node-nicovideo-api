import * as Request from "request-promise"
import * as NicoURL from "./NicoURL"
import NicoSession from './NicoSession'

const get = (options: Request.Options) => {
    options.resolveWithFullResponse = true;
    return Request.get(options);
};

const post = (options: Request.Options) => {
    options.resolveWithFullResponse = true;
    return Request.post(options);
};

export default {
    video : {
        /**
         * @param {NicoSession} session
         * @param {String} options.movieId
         * @return {Promise}
         */
        getMovieInfo(session: NicoSession, {movieId}: {movieId: string}): Request.RequestPromise
        {
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
        getFlv(session: NicoSession, {movieId}: {movieId: string}): Request.RequestPromise
        {
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
        getPlayerStatus(session: NicoSession, {liveId}: {liveId: string}): Request.RequestPromise
        {
            return get({
                url : NicoURL.Live.GET_PLAYER_STATUS + liveId,
                jar : session.cookie
            });
        }
    },

    // nsen : {
    //     /**
    //      * @param {NicoSession} session
    //      * @param {String} options.liveId     LiveID
    //      * @param {String} options.movieId    Request movie ID
    //      * @return {Promise}
    //      */
    //     request(session, {liveId, movieId}) {
    //         return get({
    //             url : NicoURL.Live.NSEN_REQUEST+`?v=${liveId}&id=${movieId}`,
    //             jar : session.cookie
    //         });
    //     },
    //             // form :
    //             //     v : liveId
    //             //     id : movieId

    //     /**
    //      * @param {NicoSession} session
    //      * @param {String} options.liveId LiveID
    //      * @return Promise
    //      */
    //     cancelRequest(session, {liveId}) {
    //         return get({
    //             url : NicoURL.Live.NSEN_REQUEST + `?v=${liveId}&mode=cancel`,
    //             jar : session.cookie
    //         });
    //     },
    //             // form :
    //             //     v : liveId
    //             //     mode : "cancel"

    //     /**
    //      * @param {NicoSession} session
    //      * @param {String} options.liveId LiveID
    //      * @return Promise
    //      */
    //     syncRequest(session, {liveId}) {
    //         return get({
    //             url : NicoURL.Live.NSEN_REQUEST + `?v=${liveId}&mode=requesting`,
    //             jar : session.cookie
    //         });
    //     },
    //             // form :
    //             //     v : liveId
    //             //     mode : "requesting"

    //     /**
    //      * @param {NicoSession} session
    //      * @param {String} options.liveId LiveID
    //      * @return Promise
    //      */
    //     sendGood(session, {liveId}) {
    //         return get({
    //             url : NicoURL.Live.NSEN_GOOD + `?v=${liveId}`,
    //             jar : session.cookie
    //         });
    //     },
    //             // form :
    //             //     v : liveId

    //     /**
    //      * @param {NicoSession} session
    //      * @param {String} options.liveId LiveID
    //      * @return Promise
    //      */
    //     sendSkip(session, {liveId}) {
    //         return get({
    //             url : NicoURL.Live.NSEN_SKIP + `?v=${liveId}`,
    //             jar : session.cookie
    //         });
    //     }
    //             // form :
    //             //     v: liveId
    // },


    user : {
        info(session: NicoSession, {userId}: {userId: number}) {
            return get({
                url : NicoURL.User.INFO + `?__format=json&user_id=${userId}`,
                jar : session.cookie
            });
        }
    }
};
