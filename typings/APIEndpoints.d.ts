/// <reference types="request-promise" />
import * as Request from "request-promise";
import NicoSession from './NicoSession';
declare var _default: {
    video: {
        getMovieInfo(session: NicoSession, {movieId}: {
            movieId: string;
        }): Request.RequestPromise;
        getFlv(session: NicoSession, {movieId}: {
            movieId: string;
        }): Request.RequestPromise;
    };
    live: {
        getPlayerStatus(session: NicoSession, {liveId}: {
            liveId: string;
        }): Request.RequestPromise;
    };
    user: {
        info(session: NicoSession, {userId}: {
            userId: string;
        }): Request.RequestPromise;
    };
};
export default _default;
